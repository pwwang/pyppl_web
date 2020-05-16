"""SocketIO operations for pyppl_web"""
from pathlib import Path
import cmdy
from flask import request
from flask_socketio import SocketIO, Namespace, emit
from pyppl.config import config
from .shared import logger, pipeline_data
from .utils import read_cmdout
# pylint: disable=no-self-use

class RootNamespace(Namespace):
    """Namespace for socketio"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.count = 0

    def on_connect(self):
        """While we are connected"""
        self.count += 1
        logger.info(f'Client {request.remote_addr} connected. '
                    f'Connected clients: {self.count}')

    def on_disconnect(self):
        """While we are disconnected"""
        self.count -= 1
        logger.info(f'Client {request.remote_addr} disconnected. '
                    f'Connected clients: {self.count}')
        if self.count == 0 and config.config.web_keepalive == 'auto':
            logger.warning("Closing server, as no clients connected.")
            self.socketio.stop()

    def on_init_req(self):
        """Initial request for pipeline status"""
        logger.debug(f'Got request init_req from client {request.remote_addr}')
        emit('init_resp', pipeline_data.pipeline.dict())

    def on_tab_proc_init_req(self, data):
        """Send the data needed to init a proc tab"""
        logger.debug('Got request tab_proc_init_req from client '
                     f'{request.remote_addr}')

        resp = pipeline_data.procs.setdefault(data['proc'], {'status': ''})
        resp['watch'] = True
        resp['proc'] = data['proc']
        emit('tab_proc_init_resp', resp)

    def on_tab_proc_destroyed(self, data):
        """When a tab destroyed, stop sending response"""
        procdata = pipeline_data.procs.setdefault(data['proc'], {})
        procdata['watch'] = False

    def on_reset_rc_req(self, data):
        """Reset job return code"""
        # proc, job, rc
        logger.debug('Got request reset_rc_req from client '
                     f'{request.remote_addr}')
        resp = {'proc': data['proc'], 'job': data['job'], 'rc': data['rc']}
        try:
            workdir = pipeline_data.procs[data['proc']].props.workdir
            (Path(workdir) / str(data['job']) / 'job.rc').write_text(
                str(data['rc'])
            )
        except BaseException as ex:
            resp['ok'] = False
            resp['msg'] = str(ex)
        else:
            resp['ok'] = True
            resp['msg'] = ''
            # save rc to pipeline_data as well
            if (data['proc'] in pipeline_data.procs and
                    'jobs' in pipeline_data.procs[data['proc']] and
                    isinstance(pipeline_data.procs
                               [data['proc']]
                               ['jobs']
                               [int(data['job'])-1], list)):
                jobdata = (pipeline_data.procs
                           [data['proc']]
                           ['jobs']
                           [int(data['job'])-1])
                jobdata[1] = int(data['rc'])
                if len(jobdata) == 2:
                    jobdata.append(True)
        emit('reset_rc_resp', resp)

    def on_remove_lock_req(self, data):
        """Reset job return code"""
        # proc, job, rc
        logger.debug('Got request remove_lock_req from client '
                     f'{request.remote_addr}')
        resp = {'proc': data['proc']}
        try:
            workdir = pipeline_data.procs[data['proc']].props.workdir
            Path(workdir).joinpath('proc.lock').unlink()
            resp['ok'] = True
            resp['msg'] = ''
        except KeyError:
            resp['ok'] = False
            resp['msg'] = 'Process has not started yet.'
        except BaseException as ex:
            resp['ok'] = False
            resp['msg'] = str(ex)
        emit('remove_lock_resp', resp)

    def on_proc_detail_req(self, data):
        """Request proc details"""
        logger.debug('Got request proc_detail_req from client '
                     f'{request.remote_addr}')
        emit('proc_detail_resp', pipeline_data.procs[data['proc']])

    def on_job_script_req(self, data):
        """Request for job.script"""
        logger.debug('Got request job_script_req from client '
                     f'{request.remote_addr}')
        resp = {'proc': data['proc'], 'job': data['job'],
                'indent': '    ', 'lang': ''}
        try:
            props = pipeline_data.procs[data['proc']].props
            jobscript = Path(props.workdir) / str(data['job']) / 'job.script'
            jobscript = jobscript.read_text()
            resp['script'] = jobscript
            # need more precise mapping
            resp['lang'] = Path(props.lang).name
        except BaseException as ex:
            resp['script'] = str(ex)
        else:
            indent1 = '\t'
            indent2 = '    '
            lines = jobscript.splitlines()
            ndent1 = sum(line.startswith(indent1) for line in lines)
            ndent2 = sum(line.startswith(indent2) for line in lines)
            resp['indent'] = indent1 if ndent1 > ndent2 else indent2
        emit('job_script_resp', resp)

    def on_job_script_running_req(self, data):
        """Request if a jobscript is running"""
        logger.debug('Got request job_script_running_req from client '
                     f'{request.remote_addr}')
        js_running_data = pipeline_data.setdefault('js_running', {})

        resp = {'proc': data['proc'], 'job': data['job'],
                'reqlog': data['reqlog'], 'isrunning': False,
                'log': ''}
        rdata = (js_running_data.
                 setdefault(data['proc'], {}).
                 setdefault(data['job'], {}))
        logger.error(str(rdata.keys()))
        if rdata:
            rdata = js_running_data[data['proc']][data['job']]
            resp['isrunning'] = True
            resp['pid'] = rdata['cmdy'].pid
            buffer = read_cmdout(rdata['cmdy'])
            if buffer is False:
                resp['isrunning'] = 'done'
                del js_running_data[data['proc']][data['job']]
            else:
                rdata['buffer'] = rdata.get('buffer', '') + buffer

            if data['reqlog'] == 'all':
                resp['log'] = rdata['buffer']
            elif data['reqlog'] == 'more':
                resp['log'] = buffer or ''
        emit('job_script_running_resp', resp)

    def on_job_script_run_req(self, data):
        """Run a job script"""
        logger.debug('Got request job_script_run_req from client '
                     f'{request.remote_addr}')
        js_running_data = pipeline_data.setdefault('js_running', {})
        rdata = (js_running_data.
                 setdefault(data['proc'], {}).
                 setdefault(data['job'], {}))
        workdir = pipeline_data.procs[data['proc']].props.workdir
        jobscript = Path(workdir) / str(int(data['job'])) / 'job.script'

        rdata['buffer'] = ''
        rdata['cmdy'] = cmdy._(_exe=str(jobscript),
                               _bg=True, _iter=True)

# pylint: disable=invalid-name
def create_socket(app):
    """Create a socketio object"""
    # We don't want to monkey patch the naive python functions
    # which destuct some of the PyPPL functionalities
    # We might be swtiching to gevent or eventlet if PyPPL is
    # switching to greenlet.
    namespace = RootNamespace('/')
    socketio = SocketIO(app, async_mode='threading', engineio_logger=False)
    socketio.on_namespace(namespace)
    return socketio, namespace

"""SocketIO operations for pyppl_web"""
from pathlib import Path
from flask import request
from flask_socketio import SocketIO, Namespace, emit
from pyppl.config import config
from .shared import logger, pipeline_data
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
        logger.debug(f'Got request reset_rc_req from client {request.remote_addr}')
        resp = {'proc': data['proc'], 'job': data.job}
        try:
            workdir = pipeline_data.procs[data['proc']]['workdir']
            Path(workdir).joinpath(data.job, 'job.rc').write_text(str(data.rc))
            resp['ok'] = True
            resp['msg'] = ''
        except BaseException as ex:
            resp['ok'] = False
            resp['msg'] = str(ex)
        emit('reset_rc_resp', resp)

    def on_remove_lock_req(self, data):
        """Reset job return code"""
        # proc, job, rc
        logger.debug(f'Got request remove_lock_req from client {request.remote_addr}')
        resp = {'proc': data['proc']}
        try:
            workdir = pipeline_data.procs[data['proc']]['workdir']
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

"""Web client to monitor pipeline processes for PyPPL"""
from threading import Thread
from pathlib import Path
from flask_socketio import SocketIO
from diot import Diot
from pyppl.plugin import hookimpl
from pyppl.logger import Logger
from pyppl.config import config
from .shared import (logger, PLUGIN, DEFAULT_PORT, DEFAULT_THEME,
                     SOCKETIO_DEBUG, DEFAULT_KEEPALIVE,
                     pipeline_data)
from .app import create_app
from .sockets import create_socket
from .utils import auto_port, PipelineData

# pylint: disable=unused-argument,no-self-use

__version__ = "0.0.1"

class PyPPLWeb:
    """Web client to monitor pipeline processes for PyPPL"""

    __version__ = __version__

    def __init__(self):

        self.port = None
        self.thread = None
        self.namespace = None
        self.app = None
        self.socketio = None
        self.pdata = pipeline_data
        self.setup()

    def start_server(self):
        """Start the socket server with given config"""
        logger.info(f"Launching web server at port {self.port} ...")
        try:
            self.socketio.run(self.app, port=self.port,
                              debug=config.config.web_debug)
        except OSError as ex:
            logger.error(f'Failed to start server: {ex}')

    def setup(self):
        """Setup the plugin"""
        config.config.web_port = DEFAULT_PORT
        config.config.web_debug = SOCKETIO_DEBUG
        config.config.web_keepalive = DEFAULT_KEEPALIVE
        config.config.web_theme = DEFAULT_THEME

    @hookimpl
    def pyppl_init(self, ppl):
        """Get the port"""
        self.port = (int(config.config.web_port)
                     if config.config.web_port != 'auto'
                     else auto_port())
        self.app = create_app(config.config.web_theme)
        self.socketio, self.namespace = create_socket(self.app)

    @hookimpl
    def pyppl_prerun(self, ppl):
        """Try to start the server in a thread"""
        # construct initial pipeline data for rendering
        self.pdata = PipelineData(ppl)
        self.pdata.assemble()
        # attach this to pipeline_data for sockets
        pipeline_data.pipeline = self.pdata
        # More detailed data for tab rendering
        pipeline_data.procs = {}
        #
        # This should be the same as using standard threading.Thread,
        # as we are using async_mode='threading'
        self.thread = Thread(target=self.start_server)
        # allow thread to stop together with mean thread
        self.thread.daemon = True
        self.thread.start()

    @hookimpl
    def pyppl_postrun(self, ppl):
        """Try to keep alive of the server
        if config.config.web_keepalive is True"""
        if not config.config.web_keepalive:
            return

        if config.config.web_keepalive is True:
            logger.info(f"Web server is still alive at port {self.port}, "
                        "use <Ctrl+C> to quit.")
            logger.info("Pending for connection ...")
        elif self.namespace.count > 0:
            logger.info(f"Web server is still alive at port {self.port}, "
                        f"clients connected: {self.namespace.count}")
        else:
            logger.warning("Web server is stopping as well, "
                           "since no clients connected.")
            # .stop only works with context
            #socketio.stop()
            # we just leave it to exit, since our thread is daemonic
            return
        self.thread.join()

    @hookimpl
    def proc_prerun(self, proc):
        """Initialize a proc"""
        self.pdata.update_node(proc, 'init')
        self.socketio.emit('pipeline_update', self.pdata.node_data(proc))
        # init proc data
        pipeline_data.procs[proc.shortname] = Diot()
        procdata = pipeline_data.procs[proc.shortname]
        procdata.jobs = [['', ''] for _ in range(proc.size)]
        procdata.status = self.pdata.node_data(proc).get('status', '')
        procdata.props = {
            key: str(getattr(proc, key))
            for key in list(proc._setcounter) + ['workdir', 'size']
        }
        procdata.props.workdir_abs = str(Path(procdata.props.workdir).resolve())
        procdata.args = {key: str(val) for key, val in proc.args.items()}
        procdata.envs = {key: str(val) for key, val in proc.envs.items()}
        procdata.config = {key: str(val) for key, val in proc.config.items()}
        procdata.watch = False
        procdata.proc = proc.shortname


    @hookimpl
    def proc_postrun(self, proc, status):
        """Update the status of the whole proc"""
        self.pdata.update_node(proc, status)
        self.socketio.emit('pipeline_update', self.pdata.node_data(proc))


    @hookimpl
    def job_build(self, job):
        """Init some data for pipeline_data.procs"""
        procdata = pipeline_data.procs[job.proc.shortname]
        procdata.jobs[job.index] = ['init', job.rc]

        if procdata.watch:
            self.socketio.emit('job_status_change',
                               {'proc': job.proc.shortname,
                                'job': job.index, # 0-based
                                'rc': job.rc,
                                'status': 'init'})

        if procdata.status == '':
            # just in case tab of the proc has not init'ed
            procdata.status = 'init'
            self.socketio.emit('tab_proc_init_resp', procdata)

    @hookimpl
    def job_poll(self, job, status):
        """Tell pipeline_data.procs that I am running"""
        if status == 'running':
            procdata = pipeline_data.procs[job.proc.shortname]
            prev_status = procdata.jobs[job.index][0]
            procdata.jobs[job.index][0] = status
            # only send once
            if procdata.watch and prev_status != 'running':
                self.socketio.emit('job_status_change',
                                   {'proc': job.proc.shortname,
                                    'job': job.index,
                                    'rc': job.rc,
                                    'status': status})

    @hookimpl
    def job_done(self, job, status):
        """Update status on the client"""
        self.pdata.update_node(job.proc, status)
        nodedata = self.pdata.node_data(job.proc)
        self.socketio.emit('pipeline_update', nodedata)

        procdata = pipeline_data.procs[job.proc.shortname]
        procdata.status = nodedata.get('status', procdata.status)
        procdata.jobs[job.index][0] = status
        procdata.jobs[job.index][1] = job.rc

        if procdata.watch:
            self.socketio.emit('job_status_change',
                               {'proc': job.proc.shortname,
                                'job': job.index,
                                'rc': job.rc,
                                'status': status})

PYPPLWEB = PyPPLWeb()

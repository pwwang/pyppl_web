"""Web client to monitor pipeline processes for PyPPL"""
from threading import Thread
from flask_socketio import SocketIO
from pyppl.exception import PluginNoSuchPlugin
from pyppl.plugin import hookimpl, _get_plugin
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

    def __init__(self):
        self.port = None
        self.thread = None
        self.namespace = None
        self.app = None
        self.socketio = None
        self.pdata = pipeline_data
        # make sure setup is running on runtime
        try:
            _get_plugin(PLUGIN)
        except PluginNoSuchPlugin:
            self.setup(config)

    def start_server(self):
        """Start the socket server with given config"""
        logger.info(f"Launching web server at port {self.port} ...")

        self.socketio.run(self.app, port=self.port,
                          debug=config.config.web_debug)

    @hookimpl
    def setup(self, config): # pylint: disable=redefined-outer-name
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

    @hookimpl
    def proc_postrun(self, proc, status):
        """Update the status of the whole proc"""
        self.pdata.update_node(proc, status)
        self.socketio.emit('pipeline_update', self.pdata.node_data(proc))

    @hookimpl
    def job_init(self, job):
        """Init some data for pipeline_data.procs"""
        procdata = pipeline_data.procs.setdefault(job.proc.shortname, {})
        jobs = procdata.setdefault('jobs', [None] * job.proc.size)
        procdata['status'] = self.pdata.node_data(job.proc).get('status', '')
        procdata['size'] = job.proc.size
        jobs[job.index] = ['init', job.rc]

    @hookimpl
    def job_poll(self, job, status):
        """Tell pipeline_data.procs that I am running"""
        if status == 'running':
            (pipeline_data.procs
             [job.proc.shortname]
             ['jobs']
             [job.index][0]) = status

    @hookimpl
    def job_done(self, job, status):
        """Update status on the client"""
        self.pdata.update_node(job.proc, status)
        nodedata = self.pdata.node_data(job.proc)
        self.socketio.emit('pipeline_update', nodedata)

        procdata = pipeline_data.procs[job.proc.shortname]
        procdata['status'] = nodedata.get('status', procdata['status'])
        procdata['jobs'][job.index] = [status, job.rc]

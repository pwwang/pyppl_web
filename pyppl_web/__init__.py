"""Web client to monitor pipeline processes for PyPPL"""
from threading import Thread
from flask_socketio import SocketIO
from pyppl.exception import PluginNoSuchPlugin
from pyppl.plugin import hookimpl, _get_plugin
from pyppl.logger import Logger
from pyppl.config import config
from .shared import (logger, PLUGIN, DEFAULT_PORT,
                     SOCKETIO_DEBUG, DEFAULT_KEEPALIVE)
from .app import app
from .sockets import socketio, root
from .utils import auto_port

# pylint: disable=unused-argument,no-self-use

__version__ = "0.0.1"

class PyPPLWeb:
    """Web client to monitor pipeline processes for PyPPL"""

    def __init__(self):
        self.port = None
        self.thread = None
        # make sure setup is running on runtime
        try:
            _get_plugin(PLUGIN)
        except PluginNoSuchPlugin:
            self.setup(config)

    def start_server(self):
        """Start the socket server with given config"""
        logger.info(f"Launching web server at port {self.port} ...")
        socketio.run(app, port=self.port,
                     debug=config.config.web_debug)

    @hookimpl
    def setup(self, config): # pylint: disable=redefined-outer-name
        """Setup the plugin"""
        config.config.web_port = DEFAULT_PORT
        config.config.web_debug = SOCKETIO_DEBUG
        config.config.web_keepalive = DEFAULT_KEEPALIVE

    @hookimpl
    def pyppl_init(self, ppl):
        """Get the port"""
        self.port = (int(config.config.web_port)
                     if config.config.web_port != 'auto'
                     else auto_port())

    @hookimpl
    def pyppl_prerun(self, ppl):
        """Try to start the server in a thread"""
        # See https://github.com/miguelgrinberg/Flask-SocketIO/issues/876
        # for not using standard theading lib
        #self.thread = Thread(target=self.start_server)
        #self.thread.start()
        #
        # This should be the same as using standard threading.Thread,
        # as we are using async_mode='threading'
        self.thread = Thread(target=self.start_server)
        # allow thread to stop together with mean thread
        self.thread.daemon = True
        self.thread.start()

    @hookimpl
    def pyppl_postrun(self, ppl, exc):
        """Try to keep alive of the server
        if config.config.web_keepalive is True"""
        if not config.config.web_keepalive:
            socketio.stop()
            if exc:
                raise exc from None

        if exc is not None:
            logger.error("")
            logger.error(f"Exception raised ({type(exc).__name__}):")
            logger.error("")
            logger.error(f"{exc}")
            logger.error("")

        if config.config.web_keepalive is True:
            logger.info(f"Web server is still alive at port {self.port}, "
                        "use <Ctrl+C> to quit.")
            logger.info("Pending for connection ...")
        elif root.count > 0:
            logger.info(f"Web server is still alive at port {self.port}, "
                        f"clients connected: {root.count}")
        else:
            logger.warning("Web server is stopping as well, "
                        "since no clients connected.")
            # .stop only works with context
            #socketio.stop()
            # we just leave it to exit, since our thread is daemonic
            return
        self.thread.join()

"""SocketIO operations for pyppl_web"""
from flask import request
from flask_socketio import SocketIO, Namespace, emit
from pyppl.config import config
from .shared import logger, pipeline_status
from .app import app

# pylint: disable=no-self-use

class RootNamespace(Namespace):
    """Namespace for socketio"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.count = 0

    def on_connect(self):
        """While we are connected"""
        self.count += 1
        logger.info(f'Client {request.remote_addr} connected.')

    def on_disconnect(self):
        """While we are disconnected"""
        self.count -= 1
        logger.info(f'Client {request.remote_addr} disconnected.')
        if self.count == 0 and config.config.web_keepalive == 'auto':
            logger.warning("Closing server, as no clients connected.")
        print(dir(self))

    def on_init_req(self):
        """Initial request for pipeline status"""
        logger.debug(f'Got request init_req from client {request.remote_addr}')
        emit('init_resp', pipeline_status.dict())

# pylint: disable=invalid-name
root = RootNamespace('/')

# We don't want to monkey patch the naive python functions
# which destuct some of the PyPPL functionalities
# We might be swtiching to gevent or eventlet if PyPPL is
# switching to greenlet.
socketio = SocketIO(app, async_mode='threading', engineio_logger=False)
socketio.on_namespace(root)

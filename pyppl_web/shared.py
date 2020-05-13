"""Some shared data"""
from diot import Diot
from pyppl.logger import Logger

PLUGIN = 'web'

DEFAULT_PORT = 8527

# This has to be False, since we are using threading and socketio engine
SOCKETIO_DEBUG = False
FLASK_DEBUG = True

DEFAULT_KEEPALIVE = "auto"
DEFAULT_THEME = "semantic"

# pylint: disable=invalid-name
logger = Logger(plugin=PLUGIN)

pipeline_data = Diot()
# pylint: enable=invalid-name

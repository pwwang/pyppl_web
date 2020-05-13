"""The Flask app and controllers"""
import logging
from flask import Flask, render_template, cli
from .shared import FLASK_DEBUG

# hide the banner message from flask
cli.show_server_banner = lambda *args: None
# pylint: disable=invalid-name
app = Flask(__name__,
            static_url_path='',
            template_folder='templates',
            static_folder='templates/static')
# pylint: enable=invalid-name

app.logger.setLevel(logging.ERROR)
app.config['SECRET_KEY'] = 'VNv3IxPlR4#L'
app.debug = FLASK_DEBUG
logging.getLogger('werkzeug').setLevel(logging.ERROR)

@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

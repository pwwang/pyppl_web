"""The Flask app and controllers"""
import logging
from flask import Flask, render_template, cli
from .shared import FLASK_DEBUG

# hide the banner message from flask
cli.show_server_banner = lambda *args: None

def create_app(theme):
    """Create a flask app"""
    app = Flask(__name__,
                static_url_path='',
                template_folder=f'templates/{theme}',
                static_folder=f'templates/{theme}/static')

    app.logger.setLevel(logging.ERROR)
    app.config['SECRET_KEY'] = 'VNv3IxPlR4#L'
    app.debug = FLASK_DEBUG
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    @app.route('/')
    def index():
        """Home page"""
        return render_template('index.html')

    return app

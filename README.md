# pyppl_web

## Installation
```shell
pip install pyppl_web
```

## Configurations
```toml
# The port used to connect
# The address will be http://localhost:<web_port>
# Use `auto` to automatically choose a port
web_port = DEFAULT_PORT
# Debug mode
web_debug = SOCKETIO_DEBUG
# Whether keep the server alive even when pipeline finishes
# True: keep it alive
# False: don't
# auto: Only keep it alive when there are clients connected
web_keepalive = DEFAULT_KEEPALIVE
```

## Screenshorts

![Pipeline][2]

![Pipeline][3]

[1]: https://github.com/pwwang/PyPPL
[2]: docs/pipeline.png
[3]: docs/process.png

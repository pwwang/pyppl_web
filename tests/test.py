from pyppl import config_plugins, PyPPL, Proc
from pyppl_web import PyPPLWeb

pweb = PyPPLWeb()
config_plugins(pweb)
proc = Proc()
proc.input = {'a': [1]}
proc.output = 'a:var:1'
proc.script = 'sleep 10'
proc.cache = False

PyPPL(logger_level='debug').start(proc).run()


from pyppl import config_plugins, PyPPL, Proc
from pyppl_web import PyPPLWeb

pweb = PyPPLWeb()
config_plugins(pweb)
proc = Proc()
proc.input = {'a': list(range(20))}
proc.output = 'a:var:1'
proc.script = ''.join(f'echo {i}; sleep 1; ' for i in range(10))
proc.cache = False

proc2 = Proc()
proc2.depends = proc
proc2.input = 'b:var'
proc2.output = 'b:var:2'
proc2.script = 'sleep 5'
proc2.cache = False

PyPPL(logger_level='debug', forks=2).start(proc).run()


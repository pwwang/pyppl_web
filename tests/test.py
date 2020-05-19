import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.resolve()))
from pyppl import config_plugins, PyPPL, Proc, ProcSet
from pyppl_web import PyPPLWeb

pweb = PyPPLWeb()
config_plugins(pweb)
proc = Proc()
proc.input = {'a': list(range(6))}
proc.output = 'fav:file:{{i.a}}.png'
proc.script = '''
wget http://localhost:8527/images/favicon.png -O {{o.fav}}
if [[ {{job.index}} -eq 3 ]]; then
    exit 1;
fi
'''
proc.cache = False

proc2 = Proc()
proc2.depends = proc
proc2.input = 'b:var'
proc2.output = 'b:var:2'
proc2.script = 'sleep 5'
proc2.cache = False

ps = ProcSet(proc, proc2)
ps.depends = proc2

PyPPL(logger_level='debug', forks=2).start(proc).run()


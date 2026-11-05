# CappyTronic – start programu użytkownika (main.py)
import sys, os, io, _hw, _ctime
sys.modules['time'] = _ctime
sys.modules['utime'] = _ctime
os.chdir('/')


def _run():
    try:
        import main
    except (KeyboardInterrupt, SystemExit):
        pass
    except BaseException as e:
        buf = io.StringIO()
        sys.print_exception(e, buf)
        _hw.exc('\n'.join(l for l in buf.getvalue().split('\n') if '/lib/_boot.py' not in l))


_run()

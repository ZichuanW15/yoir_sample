import concurrent.futures,os,pathlib,subprocess
root=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
tmp=pathlib.Path('/private/tmp/yoir-sprint3-meeting-area-20261017')
python=str(root/'backend/.venv/bin/python')
output=root/'artifacts/qa/sprint3-meeting-area-20261017'
env=os.environ.copy();env.update(CI='true',TZ='Australia/Melbourne',WEB_QA_PORT='43128',WEB_QA_OUTPUT_DIR=str(output/'browser-area-focused'),WEB_QA_DIST_DIR=str(root/'frontend/dist/web'),YOIR_QA_PYTHON=python)
commands=[('browser-area-focused',['npm','run','test:web','--','e2e/sprint3-meeting-area.spec.ts']),('frontend-lint-final',['npm','run','lint']),('frontend-typecheck-final',['npm','run','typecheck'])]
def run(item):
 label,cmd=item
 return subprocess.run([python,str(tmp/'run.py'),label,'frontend',*cmd],cwd=root,env=env).returncode
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: codes=list(pool.map(run,commands))
raise SystemExit(int(any(codes)))

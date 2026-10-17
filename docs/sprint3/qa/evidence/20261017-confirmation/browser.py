import concurrent.futures, json, os, pathlib, subprocess
ROOT=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
TMP=pathlib.Path('/private/tmp/yoir-pr246-20261017')
OUT=ROOT/'artifacts/qa/sprint3-confirmation-20261017'
PYTHON=str(ROOT/'backend/.venv/bin/python')
BASE=os.environ.copy()
for k in list(BASE):
 if k.startswith(('STRIPE_', 'MAILGUN_', 'ADMIN_', 'LIVE_API_')) or k in ('DATABASE_URL','YOIR_QA_ALLOW_DATABASE_RESET','FRONTEND_DIST'):
  BASE.pop(k,None)
BASE.update(CI='true',TZ='Australia/Melbourne',STRIPE_SECRET_KEY='',MAILGUN_API_KEY='',ADMIN_EMAIL='',ADMIN_PASSWORD='',WEB_QA_DIST_DIR=str(ROOT/'frontend/dist/web'),YOIR_QA_PYTHON=PYTHON)
results=[]
def run(view,config,port):
 for category,grep in [('regression','--grep-invert'),('defects','--grep')]:
  label=f'browser-{view}-{category}'
  env=BASE|{'WEB_QA_PORT':str(port),'WEB_QA_OUTPUT_DIR':str(OUT/label)}
  command=['node','node_modules/@playwright/test/cli.js','test','--config',config,grep,'@defect']
  done=subprocess.run([PYTHON,str(TMP/'run.py'),label,'frontend',*command],cwd=ROOT,env=env)
  results.append({'label':label,'exitCode':done.returncode})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 futures=[pool.submit(run,'desktop','playwright.config.ts',43128),pool.submit(run,'phone','playwright.mobile.config.ts',43129)]
 for f in concurrent.futures.as_completed(futures):f.result()
(OUT/'run-index-browser.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))

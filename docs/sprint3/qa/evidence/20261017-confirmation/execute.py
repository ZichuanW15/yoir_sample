import concurrent.futures, json, os, pathlib, subprocess
ROOT=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
TMP=pathlib.Path('/private/tmp/yoir-pr246-20261017')
OUT=ROOT/'artifacts/qa/sprint3-confirmation-20261017'
PYTHON=str(ROOT/'backend/.venv/bin/python')
BASE=os.environ.copy()
for k in list(BASE):
 if k.startswith(('STRIPE_', 'MAILGUN_', 'ADMIN_', 'LIVE_API_')) or k in ('DATABASE_URL','YOIR_QA_ALLOW_DATABASE_RESET','FRONTEND_DIST'):
  BASE.pop(k,None)
BASE.update(CI='true', TZ='Australia/Melbourne', STRIPE_SECRET_KEY='', MAILGUN_API_KEY='', ADMIN_EMAIL='', ADMIN_PASSWORD='')
results=[]
def run(label, command, extra=None):
 env=BASE | (extra or {})
 done=subprocess.run([PYTHON,str(TMP/'run.py'),label,'frontend',*command],cwd=ROOT,env=env)
 results.append({'label':label,'exitCode':done.returncode})
 return done.returncode

def components():
 for label,script in [('frontend-regression','test:coverage'),('ios-regression','test:ios'),('android-regression','test:android'),('frontend-defects','test:defects'),('ios-defects','test:ios:defects'),('android-defects','test:android:defects')]:
  command=['npm','run',script,'--','--json',f'--outputFile={OUT/label/"results.json"}']
  if label=='frontend-regression':command += [f'--coverageDirectory={OUT/label/"coverage"}']
  run(label,command)
 run('frontend-lint',['npm','run','lint'])
 run('frontend-typecheck',['npm','run','typecheck'])

def build():
 run('web-build',['npm','run','build:web'],{'EXPO_PUBLIC_API_URL':'/api/v1','EXPO_PUBLIC_USE_DEMO_API':'false'})

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 futures=[pool.submit(f) for f in (components,build)]
 for f in concurrent.futures.as_completed(futures):f.result()
(OUT/'run-index-components.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))

import concurrent.futures, json, os, pathlib, socket, subprocess, time, urllib.request
ROOT=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
TMP=pathlib.Path('/private/tmp/yoir-sprint3-meeting-area-20261017')
OUT=ROOT/'artifacts/qa/sprint3-meeting-area-20261017'
OUT.mkdir(parents=True,exist_ok=True)
PYTHON=str(ROOT/'backend/.venv/bin/python')
PGBIN=pathlib.Path('/opt/homebrew/opt/postgresql@16/bin')
PORT=55446
BASE=os.environ.copy()
for k in list(BASE):
 if k.startswith(('STRIPE_','MAILGUN_','ADMIN_','LIVE_API_')) or k in ('DATABASE_URL','YOIR_QA_ALLOW_DATABASE_RESET','FRONTEND_DIST'):
  BASE.pop(k,None)
BASE.update(CI='true',TZ='Australia/Melbourne',SEED_ON_STARTUP='false',STRIPE_SECRET_KEY='',MAILGUN_API_KEY='',MAILGUN_DOMAIN='',ADMIN_EMAIL='',ADMIN_PASSWORD='',JWT_SECRET='isolated-meeting-area-qa-secret-at-least-32-characters',CORS_ALLOW_ORIGINS='http://127.0.0.1:43126')
results=[]
def run(label,cwd,command,extra=None):
 env=BASE| (extra or {})
 done=subprocess.run([PYTHON,str(TMP/'run.py'),label,cwd,*command],cwd=ROOT,env=env)
 results.append({'label':label,'exitCode':done.returncode})
 return done.returncode

def frontend():
 # Regression source unchanged since preceding refresh; full advisory sets include the added confirmation case.
 for label,script in [('frontend-defects','test:defects'),('ios-defects','test:ios:defects'),('android-defects','test:android:defects')]:
  run(label,'frontend',['npm','run',script,'--','--json',f'--outputFile={OUT/label/"results.json"}'])
 run('frontend-lint','frontend',['npm','run','lint'])
 run('frontend-typecheck','frontend',['npm','run','typecheck'])

def backend():
 run('backend-test-lint','backend',[PYTHON,'-m','ruff','check','tests'])
 run('backend-source-lint','backend',[PYTHON,'-m','ruff','check','app','reset_db.py'])
 run('backend-compile','backend',[PYTHON,'-m','compileall','-q','app','reset_db.py'])
 run('backend-postgres','backend',[PYTHON,'-m','pytest','tests','-m','not live and not future_contract','-q',f'--junitxml={OUT/"backend-postgres/results.xml"}','--cov=app','--cov-report=term-missing',f'--cov-report=json:{OUT/"backend-postgres/coverage.json"}'],{'DATABASE_URL':f'postgresql://localhost:{PORT}/yoir_area_test','YOIR_QA_ALLOW_DATABASE_RESET':'true','COVERAGE_FILE':str(OUT/'backend-postgres/.coverage')})

def browser_and_live():
 if run('web-build','frontend',['npm','run','build:web'],{'EXPO_PUBLIC_API_URL':'/api/v1','EXPO_PUBLIC_USE_DEMO_API':'false'}):return
 for label,script in [('browser-regression','test:web'),('browser-defects','test:web:defects')]:
  run(label,'frontend',['npm','run',script],{'WEB_QA_PORT':'43126','WEB_QA_OUTPUT_DIR':str(OUT/label),'WEB_QA_DIST_DIR':str(ROOT/'frontend/dist/web'),'YOIR_QA_PYTHON':PYTHON})
 env=BASE|{'DATABASE_URL':f'postgresql://localhost:{PORT}/yoir_area_live_test','SEED_ON_STARTUP':'true','FRONTEND_DIST':str(ROOT/'frontend/dist/web')}
 with (OUT/'live-server.log').open('w') as log:
  server=subprocess.Popen([PYTHON,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','43127'],cwd=ROOT/'backend',env=env,stdout=log,stderr=subprocess.STDOUT)
  try:
   for _ in range(60):
    try:
     with urllib.request.urlopen('http://127.0.0.1:43127/api/v1/health',timeout=1) as r:
      if r.status==200:break
    except Exception: time.sleep(.25)
   else:raise RuntimeError('Owned live API did not become healthy')
   with urllib.request.urlopen('http://127.0.0.1:43127/') as r: assert b'id="root"' in r.read()
   live={'LIVE_API_BASE_URL':'http://127.0.0.1:43127/api/v1','LIVE_API_VERIFIED_EMAIL':'alex@example.com','LIVE_API_VERIFIED_PASSWORD':'password123'}
   run('httpx-live','backend',[PYTHON,'-m','pytest','tests/test_live_api.py','-q',f'--junitxml={OUT/"httpx-live/results.xml"}'],live)
   run('typescript-live','frontend',['npm','run','test:client:live','--','--json',f'--outputFile={OUT/"typescript-live/results.json"}'],live)
  finally:
   server.terminate()
   try:server.wait(timeout=5)
   except subprocess.TimeoutExpired:server.kill();server.wait()

sock=socket.socket();sock.bind(('127.0.0.1',PORT));sock.close()
pgdata=TMP/'postgres'
pgsocket=TMP/'pgsocket';pgsocket.mkdir(exist_ok=True)
subprocess.run([str(PGBIN/'initdb'),'-D',str(pgdata),'-A','trust','--no-locale','--encoding=UTF8'],check=True,stdout=(TMP/'pg-init.log').open('w'),stderr=subprocess.STDOUT)
subprocess.run([str(PGBIN/'pg_ctl'),'-D',str(pgdata),'-l',str(TMP/'postgres.log'),'-o',f'-h 127.0.0.1 -p {PORT} -k {pgsocket}','-w','start'],check=True)
try:
 for database in ['yoir_area_test','yoir_area_live_test']:
  subprocess.run([str(PGBIN/'createdb'),'-h','127.0.0.1','-p',str(PORT),database],check=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  futures=[pool.submit(f) for f in (frontend,backend,browser_and_live)]
  for f in concurrent.futures.as_completed(futures):f.result()
finally:
 subprocess.run([str(PGBIN/'pg_ctl'),'-D',str(pgdata),'-m','fast','-w','stop'],check=True)
 (OUT/'run-index.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))

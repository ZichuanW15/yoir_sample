import datetime, hashlib, json, os, pathlib, subprocess, sys
root=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
label,cwd,*command=sys.argv[1:]
out=root/'artifacts/qa/sprint3-meeting-area-20261017'/label
out.mkdir(parents=True,exist_ok=False)
paths=sorted(set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','frontend','backend','scripts','.github/workflows'],cwd=root,text=True).splitlines()))
def hashes():
 return {p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths if (root/p).is_file() and not any(x in p.split('/') for x in ['artifacts','coverage','__pycache__'])}
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
record={'label':label,'command':command,'cwd':cwd,'qaHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'productBaseline':subprocess.check_output(['git','rev-parse','origin/dev'],cwd=root,text=True).strip(),'startedAt':now(),'sourceSha256':hashes(),'environment':{k:os.environ[k] for k in ['YOIR_QA_ALLOW_DATABASE_RESET','WEB_QA_PORT','WEB_QA_OUTPUT_DIR','EXPO_PUBLIC_API_URL','EXPO_PUBLIC_USE_DEMO_API','COVERAGE_FILE','LIVE_API_BASE_URL','TZ','CI'] if k in os.environ}}
with (out/'console.txt').open('w') as log:
 result=subprocess.run(command,cwd=root/cwd,stdout=log,stderr=subprocess.STDOUT)
after=hashes()
record.update(exitCode=result.returncode,finishedAt=now(),changedDuringRun=[p for p in sorted(set(record['sourceSha256'])|set(after)) if record['sourceSha256'].get(p)!=after.get(p)])
(out/'execution.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k!='sourceSha256'}))
sys.exit(result.returncode)

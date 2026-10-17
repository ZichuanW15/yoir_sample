import json, pathlib, subprocess
root=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
out=root/'artifacts/qa/sprint3-confirmation-20261017'
checks=[]
for name,fmt in [('frontend-defects','jest'),('ios-defects','jest'),('android-defects','jest'),('browser-desktop-defects-final','playwright'),('browser-phone-defects-final','playwright')]:
 execution=json.loads((out/name/'execution.json').read_text())
 command=['node','scripts/check_defect_report.cjs','--format',fmt,'--report',str(out/name/'results.json'),'--outcome','failure' if execution['exitCode'] else 'success']
 r=subprocess.run(command,cwd=root,capture_output=True,text=True)
 checks.append({'label':name,'command':command,'exitCode':r.returncode,'output':r.stdout+r.stderr})
(out/'report-health.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks,indent=2))
assert all(c['exitCode']==0 for c in checks)

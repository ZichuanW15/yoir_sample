import importlib.util,pathlib,subprocess
root=pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
paths=sorted(set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=root,text=True).splitlines()))
spec=importlib.util.spec_from_file_location('metadata',root/'scripts/check_repository_metadata.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.markdown_files=lambda:[root/p for p in paths if p.endswith('.md') and (root/p).is_file()]
raise SystemExit(m.main())

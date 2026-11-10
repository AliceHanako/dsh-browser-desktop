from pathlib import Path
import os,subprocess,secrets,json,string,time,pwd,grp
# Example dedicated service account; review paths and account before deployment.
account=pwd.getpwnam('dsh')
uid=account.pw_uid
gid=grp.getgrnam('dsh').gr_gid
assert account.pw_dir=='/home/dsh', 'Review service account home before deployment'
config=Path('/home/dsh/.config/dsh-browser-desktop');profile=Path('/home/dsh/.local/share/dsh-browser-desktop/chrome-profile')
assert not config.exists(), 'Existing desktop must be reviewed, not overwritten'
for p in [config,profile]:
 p.mkdir(parents=True,mode=0o700)
 os.chown(p,uid,gid)
os.chown(profile.parent,uid,gid)
password=''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(8))
secret=config/'session.json';secret.write_text(json.dumps({'password':password})+'\n');secret.chmod(0o600);os.chown(secret,uid,gid)
r=subprocess.run(['runuser','-u','dsh','--','x11vnc','-storepasswd',password,str(config/'vnc.pass')],capture_output=True,text=True)
assert r.returncode==0,'x11vnc password generation failed'
os.chmod(config/'vnc.pass',0o600)
helper=Path('/usr/local/libexec/dsh-browser-open')
assert not helper.exists()
helper.write_text('''#!/usr/bin/python3
import os,sys,urllib.parse
urls=sys.argv[1:] or ['about:blank']
for i,url in enumerate(urls):
 if url!='about:blank' and urllib.parse.urlsplit(url).scheme not in ('http','https'):
  raise SystemExit('Only HTTP(S) browser URLs are permitted')
os.environ['DISPLAY']=':99'
os.environ['XAUTHORITY']='/run/dsh-xvfb/Xauthority'
os.execv('/usr/bin/google-chrome',['google-chrome','--user-data-dir=/home/dsh/.local/share/dsh-browser-desktop/chrome-profile','--no-first-run','--new-window',*urls])
''')
helper.chmod(0o755)
base='''[Unit]
Requires=dsh-xvfb.service
After=dsh-xvfb.service
PartOf=dsh-browser-desktop.target

[Service]
Type=simple
User=dsh
Group=dsh
Environment=DISPLAY=:99
Environment=XAUTHORITY=/run/dsh-xvfb/Xauthority
Restart=on-failure
RestartSec=3
UMask=0077
ProtectSystem=full
'''
units={
 'dsh-browser-wm.service':base+'NoNewPrivileges=true\nExecStart=/usr/bin/openbox --sm-disable\n',
 'dsh-browser-vnc.service':base+'NoNewPrivileges=true\nExecStart=/usr/bin/x11vnc -display :99 -auth /run/dsh-xvfb/Xauthority -rfbauth /home/dsh/.config/dsh-browser-desktop/vnc.pass -listen 127.0.0.1 -rfbport 15999 -noipv6 -forever -shared -noxdamage -repeat -xkb\n',
 'dsh-browser-websockify.service':base.replace('After=dsh-xvfb.service','After=dsh-xvfb.service dsh-browser-vnc.service')+'NoNewPrivileges=true\nExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:16090 127.0.0.1:15999\n',
 'dsh-browser-chrome.service':base.replace('After=dsh-xvfb.service','After=dsh-xvfb.service dsh-browser-wm.service')+'ExecStart=/usr/bin/google-chrome --user-data-dir=/home/dsh/.local/share/dsh-browser-desktop/chrome-profile --no-first-run --disable-default-apps about:blank\n',
 'dsh-browser-desktop.target':'''[Unit]
Description=DSH private browser desktop on existing Xvfb99
Requires=dsh-xvfb.service
After=dsh-xvfb.service
Wants=dsh-browser-wm.service dsh-browser-vnc.service dsh-browser-websockify.service dsh-browser-chrome.service

[Install]
WantedBy=multi-user.target
'''
}
for name,text in units.items():
 p=Path('/etc/systemd/system')/name
 assert not p.exists(), str(p)+' already exists'
 p.write_text(text)
drop=Path('/etc/systemd/system/dsh.service.d/60-browser-desktop.conf')
assert not drop.exists()
drop.write_text('''[Unit]
Wants=dsh-browser-desktop.target
After=dsh-browser-desktop.target

[Service]
Environment="BROWSER=/usr/local/libexec/dsh-browser-open"
''')
subprocess.run(['systemd-analyze','verify',*[str(Path('/etc/systemd/system')/n) for n in units]],check=True)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','dsh-browser-desktop.target'],check=True)
# DSH itself is not restarted until plugin registration is ready.
time.sleep(4)
subprocess.run(['systemctl','is-active',*units.keys()],check=True)
print('Private browser desktop started on :99, loopback VNC15999/websockify16090')
print('VNC secret generated privately; DSH restart deferred until plugin ready')

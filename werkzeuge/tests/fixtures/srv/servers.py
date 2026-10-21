# Testserver: WebDAV :8081 (verein/davpass123), SFTP :2222 (verein/sftppass123), FTPS :2121 + FTP :2122 (verein/ftppass123)
import asyncio, threading, sys, os
S=os.path.dirname(os.path.abspath(__file__))
def dav():
    from wsgidav.wsgidav_app import WsgiDAVApp
    from cheroot import wsgi
    cfg={"host":"127.0.0.1","port":8081,"provider_mapping":{"/remote.php/dav/files/verein":S+"/dav"},
         "simple_dc":{"user_mapping":{"*":{"verein":{"password":"davpass123"}}}},"http_authenticator":{"domain_controller":None,"accept_basic":True,"accept_digest":False,"default_to_digest":False},
         "verbose":1,"logging":{"enable":False}}
    app=WsgiDAVApp(cfg); wsgi.Server(("127.0.0.1",8081),app).start()
def ftp(port,tls):
    from pyftpdlib.authorizers import DummyAuthorizer
    from pyftpdlib.handlers import FTPHandler, TLS_FTPHandler
    from pyftpdlib.servers import FTPServer
    a=DummyAuthorizer(); a.add_user("verein","ftppass123",S+"/ftp",perm="elradfmwMT")
    H=TLS_FTPHandler if tls else FTPHandler
    if tls: H.certfile=S+"/ftp.crt"; H.keyfile=S+"/ftp.key"; H.tls_control_required=True; H.tls_data_required=True
    H.authorizer=a; H.passive_ports=range(60000+port%100*10,60000+port%100*10+9)
    FTPServer(("127.0.0.1",port),H).serve_forever()
async def sftp():
    import asyncssh
    class Srv(asyncssh.SSHServer):
        def begin_auth(self,u): return True
        def password_auth_supported(self): return True
        def validate_password(self,u,p): return u=="verein" and p=="sftppass123"
    class Root(asyncssh.SFTPServer):
        def __init__(self,chan): super().__init__(chan,chroot=S+"/sftp")
    if not os.path.exists(S+"/ssh_host"): asyncssh.generate_private_key("ssh-ed25519").write_private_key(S+"/ssh_host")   # Testschlüssel bei Bedarf erzeugen
    for d in ("dav","ftp","sftp"): os.makedirs(S+"/"+d, exist_ok=True)
    await asyncssh.listen("127.0.0.1",2222,server_host_keys=[S+"/ssh_host"],server_factory=Srv,sftp_factory=Root)
    await asyncio.Future()
mode=sys.argv[1] if len(sys.argv)>1 else "main"
if mode=="ftps": ftp(2121,True)
elif mode=="ftp": ftp(2122,False)
else:
    threading.Thread(target=dav,daemon=True).start(); asyncio.run(sftp())

SITE DOMAIN: https://johndecastro.site
----------------------
Members: John De Castro
----------------------
grader username: grader
grader password: "cse135!!"
----------------------
Auto-deploy setup:
For this project, I've set it up so that commits pushed to main on Github will auto deploy the site files to my DigitalOcean droplet @:
https://johndecastro.site/

Setup:
1. Clone repo to local, edit, commit, and push to main
2. .github/workflows/deploy.yml triggers for every push to main
   Here, it checks out repo, starts SSH agent using private deploy key that is stored in Github secrets
   Adds droplet's host key to known_host
   Uses rsync to upload repo files to /var/www/johndecastro.site on droplet
3. Configured secrets where private key, server host, server user, and server paths are stored
4. Setup Droplet where dedicated SSH key was generated for actions and isntalled rsync on droplet.
5. Lastly, Github-Deploy,mp4 in repo showcases editing of file, commit and push to github, where actions run successfuly and updates site.
----------------------
Info for logging into site (for members / team):
Username: teamuser
Password: cse135!!
----------------------
Compression (part 3 step 5):
- enabled mod_deflate to compress HTML, CSS, and JS before sending o client. 
- reduces file size during transfer which will improve load time.
- verified in chrome dev tools under network tab, inspected the HTML file "Content-Encoding: gzip" header is there.
----------------------
Obscure Server Identity (part 3 step 6):
1. enabled mod_headers and confirm headers_module (Shared) was loaded.
2. edited virtual host config where i added
   "Header always unset Server" & "Header always set Server "CSE135 Server"
   to .site.conf and .site-le-ssl.conf. this removed default server header
3. restarted apache, verified change in both curl and dev tools that server reflected change.
-----------------------


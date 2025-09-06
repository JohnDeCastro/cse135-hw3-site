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
Dashboard

Live dashboard: [reporting.johndecastro.site](https://reporting.johndecastro.site)  
Detailed report (Errors): [reporting.johndecastro.site/errors.html](https://reporting.johndecastro.site/errors.html)

Metrics + Visualizations
- **Pageviews over time** → *Line chart*  
  - Chosen because line charts highlight trends in time-series data.  
  - Answers: “Is traffic rising/falling? Are there spikes?”  

- **Top routes** → *Bar chart*  
  - Bar chart is best for comparing discrete categories (routes/pages).  
  - Answers: “Which pages get the most traffic?”  

- **Recent errors** → *Table (grid)*  
  - Tabular layout makes detailed error counts easy to scan.  
  - Answers: “Which endpoints are failing, and when?”  

- **Error rate over time** → *Line chart*  
  - Complements the table by showing error spikes vs. normal baseline.  

Design Decisions
- **3 different metrics** (pageviews, top routes, errors) with **3 different presentations** (line, bar, grid).  
- Charts chosen to match the data shape (time-series → line, categories → bar, details → table).  
- Dashboard is client-side (HTML/JS + chart.js) and fetches data via the `/api/analytics/*` endpoints.  
- Layout uses a simple responsive grid with cards for readability.  

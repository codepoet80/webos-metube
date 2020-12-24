Depends on MeTube fork: 
https://github.com/codepoet80/metube

Create a folder like: ~/youtube-dl
chmod 755 ~/youtube-dl
chgrp www-data ~/youtube-dl

Start with:
sudo docker run --restart=always -d -p 8081:8081 -v /home/pi/youtube-dl:/downloads --user 1000:1000 codepoet80/metube

Cleanup with a cron job like:
*/15 * * * * /home/pi/youtube-cleanup.sh

Apache setup:
config.php file should point to download directory created above.
A virtual directory called "play" should point to the same directory.
Add your Google API key
www-data group should have read and execute on that directory.

This is a Apache2/PHP service wrapper for MeTube (https://github.com/alexta69/metube).

It adds some security, based on shared secrets that you will establish in both the config file, and any clients. Also in the config file, you must set the file_dir to match the downloads folder that MeTube is using.

The included clean-up script should also know the downloads path, and be scheduled to run in a cron job like:

`*/15 * * * * /var/www/metube/youtube-cleanup.sh`
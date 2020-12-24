#!/bin/bash
find /home/pi/youtube-dl/*.mp4 -mmin +10 -exec rm -r {} \;

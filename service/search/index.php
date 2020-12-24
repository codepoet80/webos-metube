<?php
/*
Send a YouTube search request to Google on behalf of a device that cannot
*/

header('Content-Type: application/json');
$config = include('../config.php');
$api_key = $config['api_key'];

$the_query = $_SERVER['QUERY_STRING'];
if (isset($_GET["key"])) {
	$api_key = $_GET["key"];
}

$search_path = "https://www.googleapis.com/youtube/v3/search?" . $the_query . "&key=". $api_key;

$myfile = fopen($search_path, "rb");
$content = stream_get_contents($myfile);
fclose($myfile);

echo ($content);
?>

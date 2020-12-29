<?php
/*
Send a YouTube search request to Google on behalf of a device that cannot
*/

header('Content-Type: application/json');
$config = include('config.php');
$api_key = $config['api_key'];
$client_key = $config['client_key'];
$debug_key = $config['debug_key'];

$request_headers = getallheaders();
if (!array_key_exists('Client-Id', $request_headers)) {
       echo "{\"status\": \"error\", \"msg\": \"ERROR: Not authorized, no key.\"}";
       die;
} else {
        $request_key = $request_headers['Client-Id'];
        if (($request_key != $client_key) && ($request_key != $debug_key)) {
                echo "{\"status\": \"error\", \"msg\": \"ERROR: Not authorized, bad key.\"}";
                die;
        }
}

$the_query = $_SERVER['QUERY_STRING'];
if (isset($_GET["key"])) {
	$api_key = $_GET["key"];
}

$search_path = "https://www.googleapis.com/youtube/v3/search?" . $the_query . "&key=". $api_key;

$myfile = fopen($search_path, "rb");
$content = stream_get_contents($myfile);
fclose($myfile);
if (!isset($content) || $content == "") {
        echo "{\"status\": \"error\", \"msg\": \"ERROR: No response from Google. API quota may have been exceeded.\"}";
	die;
}
echo ($content);
?>

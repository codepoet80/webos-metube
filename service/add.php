<?php
/*
Send a MeTube add request to a local MeTube
*/

header('Content-Type: application/json');

$config = include('config.php');
$metube_url = $config['metube_url'] . "/add";
$metube_port = $config['metube_port'];
$server_id = $config['server_id'];
$client_key = $config['client_key'];
$debug_key = $config['debug_key'];

$request = file_get_contents("php://input");
//echo "request was: " + $request;
//die;
$request_headers = getallheaders();
if (!array_key_exists('Client-Id', $request_headers)) {
        echo "{\"status\": \"error\", \"msg\": \"ERROR: Not authorized\"}";
        die;
} else {
        $request_key = $request_headers['Client-Id'];
        if (($request_key != $client_key) && ($request_key != $debug_key)) {
                echo "{\"status\": \"error\", \"msg\": \"ERROR: No authorized user.\"}";
                die;
        }
}

if (strpos($request, $server_id) !== false)
{
	//decode inbound request
	$request = str_replace($server_id, "", $request);
	$request = base64_decode($request);

	//prepare outbound request
	$request = "{\"url\":\"" . $request . "\", \"quality\":\"custom:" . urlencode("bestvideo[ext=mp4]+bestaudio[ext=aac]/best[ext=mp4]/best") . "\"}";

	//make outbound request to metube
	$curl = curl_init();
	curl_setopt_array($curl, array(
		CURLOPT_PORT => $metube_port,
  		CURLOPT_URL => $metube_url,
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_ENCODING => "",
		CURLOPT_MAXREDIRS => 10,
		CURLOPT_TIMEOUT => 30,
		CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
		CURLOPT_CUSTOMREQUEST => "POST",
		CURLOPT_POSTFIELDS => $request,
		CURLOPT_HTTPHEADER => array(
		    "cache-control: no-cache",
  		),
	));

	$response = curl_exec($curl);
	$err = curl_error($curl);

	curl_close($curl);

	if ($err) {
	  echo "Request error:" . $err;
	}
	else {
	  	echo $response;
	}
}
else
{
	echo "{\"status\": \"error\", \"msg\": \"ERROR: Bad request content.\"}";
}

?>

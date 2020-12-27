<?php

$config = include('config.php');
$dir = $config['file_dir'];
$server_id = $config['server_id'];
$client_key = $config['client_key'];
$debug_key = $config['debug_key'];
$debug_mode = true;

//validate request id
$request_id = $_GET['requestid'];
if (strpos($request_id, $server_id) !== false)
{
	$video_requested = $_SERVER['QUERY_STRING'];
	$video_requested = str_replace("&requestid=". $request_id, "", $video_requested);
	$video_requested = str_replace("video=", "", urldecode($video_requested));

	//decode the request
	$request_id = str_replace($server_id, "", $request_id);
	$request_id = base64_decode($request_id);
	if (strpos($request_id, "|") !== false){
		$request_parts = explode("|", $request_id);
		if ((!in_array($client_key, $request_parts)) && (!in_array($debug_key, $request_parts))) {
			//no client key
			header('HTTP/1.1 403 Forbidden');
			echo ("Not authorized");
			die;
		} else {
			if (in_array($debug_key, $request_parts))
				$debug_mode = true;
			$request_id = str_replace($client_key, "", $request_id);
			$request_id = str_replace($debug_key, "", $request_id);
			$request_id = str_replace("|", "", $request_id);
			if (urldecode($request_id) != rawurldecode($video_requested)) {
				header('HTTP/1.1 406 Not acceptable');
                        	echo ("Not acceptable<br>");
				if ($debug_mode) {
					echo urldecode($request_id) . "!=<br>" . rawurldecode($video_requested);
				}
				die;
			}
		}
	} else {
		header('HTTP/1.1 403 Forbidden');
		echo "Bad request";
		die;
	}

	//decode requested file
	$file_name = rawurldecode($video_requested);

	//try to find and send the requested file
	$file_name = $dir . $file_name;

	//TODO: we could also limit file size here
	if (file_exists($file_name)) {
		$file_size = (string)(filesize($file_name));
		header('Content-Type: video/mp4');
		header('Accept-Ranges: bytes');
		header('Content-Length: '.$file_size);
		header("Content-Disposition: inline;");
		header("Content-Range: bytes .$file_size");
		header("Content-Transfer-Encoding: binary\n");
		header('Connection: close');

		readfile($file_name);
	} else {
		header("HTTP/1.1 410 Gone");
		echo ("File doesn't exist<br>");
		if ($debug_mode) {
			echo $file_name . "<br>";
		}
		die;
	}

} else {
	header("HTTP/1.1 418 I'm a teapot");
	echo ("Bad request");
	die;
}
?>

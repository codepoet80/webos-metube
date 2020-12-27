<?php
header('Content-Type: application/json');

$config = include('config.php');
$dir = $config['file_dir'];
$server_id = $config['server_id'];
$client_key = $config['client_key'];
$debug_key = $config['debug_key'];

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

//make file list
$list = array(); //main array
if(is_dir($dir)){
    if($dh = opendir($dir)){
        while(($file = readdir($dh)) != false){

            if($file == "." or $file == ".." or strpos($file, ".") == false or strpos($file, ".php") != false or strpos($file, ".mp4.part") != false){
                //skip this file
            } else { //create object with two fields
		$path = $dir . "/" . $file;
		$ret_file = $file;
		if ($request_key == $debug_key)
			$ret_file = $ret_file . "|" . filesize($path);
		//$ret_file = base64_encode($ret_file);
		$ret_file = encode_response($ret_file, $server_id);
                $list3 = array(
                'file' => $ret_file);
                array_push($list, $list3);

            }
        }
    }

    $return_array = array('files'=> $list);
    echo json_encode($return_array);
}

function encode_response($the_response, $server_id) {
	if (strpos($the_response, "|") !== false) {
		$strlength = strpos($the_response, "|");
	} else {
		$strlength = strlen($the_response);
	}
	$split_pos = rand(1, $strlength);
	$the_response = base64_encode($the_response);
	$str1 = substr($the_response, 0, $split_pos);
	$str2 = substr($the_response, $split_pos);
	$the_response = $str1 . $server_id . $str2;
	return $the_response;
}
?>


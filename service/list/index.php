<?php
header('Content-Type: application/json');

$config = include('../config.php');
$dir = $config['file_dir']; //path

$list = array(); //main array

if(is_dir($dir)){
    if($dh = opendir($dir)){
        while(($file = readdir($dh)) != false){

            if($file == "." or $file == ".." or strpos($file, ".") == false or strpos($file, ".php") != false){
                //...
            } else { //create object with two fields
		$path = $dir . "/" . $file;
                $list3 = array(
                'file' => $file,
                'size' => filesize($path),
                'date' => filemtime($path));
                array_push($list, $list3);
            }
        }
    }

    $return_array = array('files'=> $list);

    echo json_encode($return_array);
}

?>


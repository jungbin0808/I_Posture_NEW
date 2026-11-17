import {cp,mkdir,rm} from 'node:fs/promises';
await rm('public/pose',{recursive:true,force:true});await mkdir('public/pose',{recursive:true});await cp('node_modules/@mediapipe/pose','public/pose',{recursive:true,filter:p=>!p.endsWith('pose_landmark_heavy.tflite')&&!p.endsWith('pose_landmark_lite.tflite')});

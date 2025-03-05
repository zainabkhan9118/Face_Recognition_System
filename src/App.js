import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import FaceRecognition from './components/FaceRecognition';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detections, setDetections] = useState([]);
  const [labeledDescriptors, setLabeledDescriptors] = useState(null);
  const [faceMatcher, setFaceMatcher] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    };

    loadModels();
  }, []);

  const handleVideoOnPlay = () => {
    setInterval(async () => {
      if (videoRef.current) {
        const detections = await faceapi
          .detectAllFaces(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions();

        if (faceMatcher) {
          const results = detections.map(d => {
            return faceMatcher.findBestMatch(d.descriptor);
          });
          setDetections({ detections, results });
        } else {
          setDetections({ detections, results: [] });
        }
      }
    }, 100);
  };

  return (
    <div className="App">
      <h1>Face Recognition App</h1>
      {modelsLoaded ? (
        <FaceRecognition
          videoRef={videoRef}
          handleVideoOnPlay={handleVideoOnPlay}
          detections={detections}
          setLabeledDescriptors={setLabeledDescriptors}
          setFaceMatcher={setFaceMatcher}
        />
      ) : (
        <p>Loading models...</p>
      )}
    </div>
  );
}

export default App;
import React, { useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import './FaceRecognition.css';

const FaceRecognition = ({ videoRef }) => {
  const [capturedImages, setCapturedImages] = useState([]);
  const [personName, setPersonName] = useState('');
  const [recognizedFaces, setRecognizedFaces] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [labeledDescriptors, setLabeledDescriptors] = useState([]);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [savedFaces, setSavedFaces] = useState([]);

  const loadSavedFaces = async () => {
    try {
      const response = await fetch('http://localhost:5000/saved-faces');
      const faces = await response.json();
      setSavedFaces(faces);
      console.log('Loaded saved faces:', faces);

      const descriptors = [];
      for (const face of faces) {
        try {
          const img = await faceapi.fetchImage(`http://localhost:5000${face.url}`);
          const detection = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            descriptors.push(
              new faceapi.LabeledFaceDescriptors(
                face.name,
                [detection.descriptor]
              )
            );
            console.log(`Loaded face descriptor for ${face.name}`);
          }
        } catch (error) {
          console.error(`Error processing face ${face.name}:`, error);
        }
      }

      if (descriptors.length > 0) {
        setLabeledDescriptors(descriptors);
        const matcher = new faceapi.FaceMatcher(descriptors, 0.6);
        setFaceMatcher(matcher);
        console.log(`Initialized face matcher with ${descriptors.length} faces`);
      }
    } catch (error) {
      console.error('Error loading saved faces:', error);
    }
  };

  useEffect(() => {
    const loadModelsAndFaces = async () => {
      try {
        setIsModelLoading(true);
        const MODEL_URL = process.env.PUBLIC_URL + '/models';
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        console.log('Face-api models loaded');
        await loadSavedFaces();
        setIsModelLoading(false);
      } catch (error) {
        console.error('Error loading models or saved faces:', error);
        setIsModelLoading(false);
      }
    };

    loadModelsAndFaces();
  }, []);

  
 // Update the video initialization useEffect
useEffect(() => {
  const startVideo = async () => {
    try {
      console.log('Requesting camera access...');
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 560 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            resolve();
          };
        });

        await videoRef.current.play();
        console.log('Video playback started');
        setIsVideoReady(true);
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      alert('Camera access failed. Please check your camera permissions and refresh the page.');
    }
  };

  if (!isModelLoading) {
    startVideo();
  }

  return () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };
}, [videoRef, isModelLoading]);

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;

    const setupCanvas = async () => {
      const canvas = faceapi.createCanvasFromMedia(videoRef.current);
      const container = document.querySelector('.face-recognition-container');
      container.appendChild(canvas);
      canvas.style.position = 'absolute';
      canvas.style.top = videoRef.current.offsetTop + 'px';
      canvas.style.left = videoRef.current.offsetLeft + 'px';

      const displaySize = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      };
      faceapi.matchDimensions(canvas, displaySize);

      let animationFrameId;

      const recognizeFaces = async () => {
        if (!videoRef.current || !canvas) return;

        const detections = await faceapi
          .detectAllFaces(videoRef.current)
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptors();

        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize);

          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

          if (faceMatcher) {
            const results = resizedDetections.map(d => {
              const match = faceMatcher.findBestMatch(d.descriptor);
              return match;
            });

            results.forEach((result, i) => {
              const box = resizedDetections[i].detection.box;
              const confidence = (1 - result.distance) * 100; // Convert distance to confidence percentage
              const drawBox = new faceapi.draw.DrawBox(box, {
                label: `${result.label} (${confidence.toFixed(1)}% match)`,
                boxColor: result.distance < 0.6 ? 'green' : 'red'
              });
              drawBox.draw(canvas);
            });

            setRecognizedFaces(results);
          }
        }

        animationFrameId = requestAnimationFrame(recognizeFaces);
      };

      recognizeFaces();

      return () => {
        cancelAnimationFrame(animationFrameId);
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      };
    };

    setupCanvas();
  }, [videoRef, faceMatcher, isVideoReady]);

// Update the captureImage function
const captureImage = async () => {
  if (!personName) {
    alert('Please enter a name for this face');
    return;
  }

  if (!videoRef.current || !isVideoReady) {
    alert('Video is not ready yet');
    return;
  }

  const video = videoRef.current;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    const detection = await faceapi
      .detectSingleFace(canvas)
      .withFaceLandmarks()
      .withFaceDescriptor()
      .withFaceExpressions(); 

    if (!detection) {
      alert('No face detected in the image');
      return;
    }

    // Draw detections, landmarks, and expressions on the canvas
    const resizedDetection = faceapi.resizeResults(detection, {
      width: canvas.width,
      height: canvas.height,
    });
    faceapi.draw.drawDetections(canvas, resizedDetection);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetection); // Draw expressions

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const formData = new FormData();
    formData.append('image', blob, `${personName}.jpg`);

    const response = await fetch('http://localhost:5000/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    console.log('Image saved successfully:', data);

    const newDescriptor = new faceapi.LabeledFaceDescriptors(
      personName,
      [detection.descriptor]
    );

    setLabeledDescriptors(prev => [...(prev || []), newDescriptor]);
    setFaceMatcher(new faceapi.FaceMatcher([...(labeledDescriptors || []), newDescriptor], 0.6));

    await loadSavedFaces(); // Reload saved faces
    setPersonName(''); // Clear the name input
  } catch (error) {
    console.error('Error capturing image:', error);
    alert('Failed to save image. Please try again.');
  }
};

  return (
    <div className="face-recognition-container">
      {isModelLoading ? (
        <div className="loading">Loading models and saved faces...</div>
      ) : (
        <>
          {!isVideoReady && <div className="loading">Initializing camera...</div>}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="720"
            height="560"
            className="video-stream"
          />
          <div className="controls-container">
            <input
              type="text"
              placeholder="Enter person's name"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="name-input"
            />
            <button 
              onClick={captureImage}
              className="capture-button"
              disabled={!isVideoReady}
            >
              Capture and Train
            </button>
          </div>

          <div className="saved-faces-grid">
            {savedFaces.map((face, index) => {
              // Check if this face matches any of the recognized faces
              const isMatched = recognizedFaces.some(
                result => result.toString().includes(face.name)
              );
              
              return (
                <div 
                  key={index} 
                  className={`saved-face ${isMatched ? 'matched' : ''}`}
                >
                  <img
                    src={`http://localhost:5000${face.url}`}
                    alt={face.name}
                    className="saved-face-image"
                  />
                  <span className="saved-face-name">{face.name}</span>
                </div>
              );
            })}
          </div>
          
          {recognizedFaces.length > 0 && (
            <div className="recognized-faces">
              <h3>Recognized Faces:</h3>
              {recognizedFaces.map((result, index) => (
              <div key={index} className="recognition-result">
                <span className="name">{result.label}</span>
                <span className={`confidence ${result.distance < 0.6 ? 'high' : 'low'}`}>
                  {((1 - result.distance) * 100).toFixed(1)}% match
                </span>
              </div>
            ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FaceRecognition;
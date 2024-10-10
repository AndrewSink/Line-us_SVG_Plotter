console.log('Have fun plotting!');

let connected = false;
let lineusAddress = "ws://line-us.local"; // WebSocket address for the plotter
let socket;
const connectionStatus = document.getElementById('connectionStatus');

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let svgTranslateX = 0;
let svgTranslateY = 0;
let svgOffsetX = 0;
let svgOffsetY = 0;
let svgScale = 1; // Default scale

const line_min_x = 650;
const line_max_x = 1775;
const line_min_y = -1000;
const line_max_y = 1000;
const plotterWidth = line_max_x - line_min_x; // 1125 units
const plotterHeight = line_max_y - line_min_y; // 2000 units

// Function to handle mouse down event on the SVG element
function onMouseDown(event) {
    const svgContainer = document.getElementById('svg-container');
    const svgElement = SVG('#svg-container').findOne('svg');
    const sidebar = document.querySelector('.sidebar');
    const scaleSlider = document.getElementById('scaleSlider');

    // Check if the click originated from the sidebar or slider
    if (sidebar.contains(event.target) || scaleSlider.contains(event.target)) {
        // Do nothing if the click is on the sidebar or slider
        return;
    }

    if (svgElement && svgContainer) {
        // Check if the mouse is inside the SVG container bounds
        const containerRect = svgContainer.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        if (
            mouseX >= containerRect.left &&
            mouseX <= containerRect.right &&
            mouseY >= containerRect.top &&
            mouseY <= containerRect.bottom
        ) {
            // Only start dragging if the mouse is inside the container
            isDragging = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
        }
    }
}

// Function to handle mouse move event to translate the SVG element
function onMouseMove(event) {
    if (isDragging) {
        const deltaX = (event.clientX - dragStartX) / svgScale; // Adjust delta based on the current scale
        const deltaY = (event.clientY - dragStartY) / svgScale; // Adjust delta based on the current scale
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        // Update the SVG's translation values with the adjusted delta
        svgTranslateX += deltaX;
        svgTranslateY += deltaY;

        // Apply the updated transformation to the SVG element
        applyTransformations();
    }
}

// Function to handle mouse up event
function onMouseUp() {
    isDragging = false;
}

// Add event listeners for mouse interactions
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// Function to extract points from SVG paths for plotting
function extractSVGPoints(svgElement) {
    let points = [];
    svgElement.find('path').forEach((path) => {
        const length = path.length();
        const numPoints = Math.floor(length / 10); // Adjust the density of points as needed

        for (let i = 0; i <= numPoints; i++) {
            const point = path.pointAt((i / numPoints) * length);
            points.push({ x: point.x, y: point.y });
        }
    });
    return points;
}
// Load the default SVG file when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadDefaultSVG();
});

document.getElementById('svg-upload').addEventListener('change', handleFileUpload);

document.getElementById("homeButton").addEventListener("click", moveToHome);

function moveToHome() {
    if (connected) {
        sendGCode(1000, 1000, 1000);
        console.log("Returning to Home position");
    } else {
        console.log("Not connected to Line-us.");
    }
}

function sendGCode(x, y, z) {
    if (connected && socket.readyState === WebSocket.OPEN) {
        const gCode = `G01 X${x} Y${y} Z${z}`;
        socket.send(gCode);
        console.log("Sent:", gCode);
    } else {
        console.log("WebSocket not connected.");
    }
}

socket = new WebSocket(lineusAddress); // Establish WebSocket connection
socket.onopen = () => {
    connected = true;
    updateConnectionStatus(true); // Update the status indicator to show "Connected"
    console.log("Connected to Line-us");
};

socket.onerror = (error) => {
    console.error("WebSocket Error: ", error);
};

socket.onmessage = (event) => {
    console.log("Message from Line-us: ", event.data);
};

// Function to update the connection status indicator
function updateConnectionStatus(isConnected) {
    if (isConnected) {
        connectionStatus.classList.remove('btn-danger');
        connectionStatus.classList.add('btn-success');
        connectionStatus.textContent = 'Connected';
    } else {
        connectionStatus.classList.remove('btn-success');
        connectionStatus.classList.add('btn-danger');
        connectionStatus.textContent = 'Not Connected';
    }
}


// Function to fetch and display the default SVG file
function loadDefaultSVG() {
    fetch('data/venn.svg')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(svgData => {
            displaySVG(svgData);
        })
        .catch(error => {
            console.error('Error loading default SVG:', error);
        });
}

// Function to map SVG points to the plotter's coordinate system considering translations and scaling
function mapSVGToPlotter(points) {
    let mappedPoints = [];

    const plotterWidth = 1125; // Line-us drawing area width in units
    const plotterHeight = 2000; // Line-us drawing area height in units
    const offsetX = line_min_x; // Minimum X position for the plotter
    const offsetY = line_max_y; // Maximum Y position for the plotter (note: Y-axis is inverted)

    const svgElement = SVG('#svg-container').findOne('svg');
    const transform = svgElement.transform(); // Get the current translation and scale of the SVG

    points.forEach(point => {
        // Apply the SVG's scaling and translation to each point
        let translatedX = (point.x * transform.scaleX) + transform.translateX;
        let translatedY = (point.y * transform.scaleY) + transform.translateY;

        // Map the translated points to the plotter's coordinate system
        let x = (translatedX / svgElement.viewbox().width) * plotterWidth + offsetX;
        let y = offsetY - (translatedY / svgElement.viewbox().height) * plotterHeight; // Adjust Y-axis for plotter

        // Only add points that fall within the plotter's range
        if (x >= line_min_x && x <= line_max_x && y >= line_min_y && y <= line_max_y) {
            mappedPoints.push({ x: x, y: y });
        }
    });

    console.log('Mapped Points for Plotter:', mappedPoints); // Debugging: log the mapped points
    return mappedPoints;
}


// Function to plot the SVG using the mapped points with correct pen control
function plotSVG() {
    console.log("Starting the plot process...");

    if (!connected) {
        console.log("Not connected to Line-us.");
        return;
    }

    // Get the SVG element from the visualizer
    const svgElement = SVG('#svg-container').findOne('svg');
    if (!svgElement) {
        console.error("No SVG found to plot.");
        return;
    }

    console.log("SVG found, extracting points...");

    // Extract points from the SVG paths
    const rawPoints = extractSVGPoints(svgElement);
    console.log("Extracted raw points:", rawPoints);

    if (rawPoints.length === 0) {
        console.error("No points extracted from the SVG.");
        return;
    }

    // Map the SVG points to plotter coordinates
    const mappedPoints = mapSVGToPlotter(rawPoints);
    console.log("Mapped points for plotter:", mappedPoints);

    if (mappedPoints.length === 0) {
        console.error("No mapped points to plot.");
        return;
    }

    console.log("Plotting the points...");

    // Ensure correct pen control sequence while plotting
    let previousPoint = null;

    mappedPoints.forEach((point, index) => {
        if (previousPoint === null || isDisconnectedPath(previousPoint, point)) {
            // If it's the start of a new path or a disconnected path:
            sendGCode(previousPoint ? previousPoint.x : point.x, previousPoint ? previousPoint.y : point.y, 1000); // Lift pen
            sendGCode(point.x, point.y, 1000); // Move to the start of the new line with the pen lifted
            sendGCode(point.x, point.y, 0); // Lower pen to start drawing
        } else {
            // Draw a connected line to the next point
            sendGCode(point.x, point.y, 0); // Pen stays down for connected points
        }

        previousPoint = point; // Update previous point
    });

    // Ensure the pen lifts at the end of the drawing
    sendGCode(mappedPoints[mappedPoints.length - 1].x, mappedPoints[mappedPoints.length - 1].y, 1000); // Lift pen after drawing
    moveToHome()
    console.log("Plotting completed.");
}

// Helper function to determine if two points are from disconnected paths
function isDisconnectedPath(point1, point2) {
    // Check if the points are far apart, indicating a disconnected path
    const distanceThreshold = 20; // Adjust threshold as needed
    const distance = Math.sqrt(
        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
    return distance > distanceThreshold;
}

// File upload handling for user-uploaded SVGs
document.getElementById('svg-upload').addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
    const file = event.target.files[0];

    if (file && file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                displaySVG(e.target.result);
            } catch (error) {
                console.error('Error displaying SVG:', error);
                alert('There was an error displaying your SVG. Please try another file.');
            }
        };
        reader.readAsText(file);
    } else {
        alert('Please upload a valid SVG file.');
    }
}

// Make sure this event listener is properly set up after the DOM has loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("plotButton").addEventListener("click", () => {
        console.log("Plot button clicked");
        plotSVG();
    });
});

function displaySVG(svgData) {
    const container = document.getElementById('svg-container');
    container.innerHTML = ''; // Clear any previous SVGs
    const draw = SVG().addTo('#svg-container').size('100%', '100%');

    try {
        const svgElement = draw.svg(svgData);

        // Set the viewBox to precisely match the Line-us drawing area dimensions
        const plotterWidth = 1125; // Line-us drawing area width
        const plotterHeight = 2000; // Line-us drawing area height

        // Set the viewBox to start at (0, 0) with the correct width and height
        svgElement.viewbox(0, 0, plotterWidth, plotterHeight);
        svgElement.attr({ preserveAspectRatio: 'xMidYMid meet' });

        console.log('SVG successfully rendered and centered.');
    } catch (error) {
        console.error('Error rendering SVG with SVG.js:', error);
        alert('Error rendering SVG. Please make sure the file is properly formatted.');
    }
}

// Function to resize the SVG container dynamically while maintaining the aspect ratio
function resizeSvgContainer() {
    const svgContainer = document.querySelector('.svg-drawing-area');
    const aspectRatio = 1125 / 2000;

    // Calculate available viewport size
    const viewportWidth = window.innerWidth * 0.9; // 90% of viewport width
    const viewportHeight = window.innerHeight * 0.8; // 80% of viewport height

    // Set dimensions based on the aspect ratio to fit within the viewport
    if (viewportWidth / aspectRatio > viewportHeight) {
        svgContainer.style.width = `${viewportHeight * aspectRatio}px`;
        svgContainer.style.height = `${viewportHeight}px`;
    } else {
        svgContainer.style.width = `${viewportWidth}px`;
        svgContainer.style.height = `${viewportWidth / aspectRatio}px`;
    }
}

// Function to apply both the translation and scaling transformations to the SVG element
function updateSVGTransform() {
    const svgElement = SVG('#svg-container').findOne('svg');
    if (svgElement) {
        // Get the bounding box of the SVG elements to center the transformations
        const bbox = svgElement.bbox();
        const centerX = bbox.cx;
        const centerY = bbox.cy;

        // Apply both translation and scaling transformations around the center of the bounding box
        svgElement.transform({
            scaleX: svgScale,
            scaleY: svgScale,
            translateX: svgTranslateX,
            translateY: svgTranslateY,
            originX: centerX,
            originY: centerY
        });
    }
}

// Function to update the SVG drawing area to match the Line-us plotter's dimensions
function updateSVGDrawingArea() {
    const svgElement = SVG('#svg-container').findOne('svg');

    if (svgElement) {
        // Define the plotter's drawing area dimensions
        const plotterWidth = 1125; // width in drawing units
        const plotterHeight = 2000; // height in drawing units

        // Set the viewBox to match the plotter's drawing area dimensions
        svgElement.viewbox(0, 0, plotterWidth, plotterHeight);
        svgElement.attr({ preserveAspectRatio: 'xMidYMid meet' });

        console.log('SVG successfully updated to match the plotter\'s drawing area.');
    }
}

// Call resizeSvgContainer on window resize and page load to ensure responsive scaling
window.addEventListener('resize', resizeSvgContainer);
document.addEventListener('DOMContentLoaded', resizeSvgContainer);

// Function to scale the SVG based on its bounding box
function updateSVGScale() {
    const svgElement = SVG('#svg-container').findOne('svg');
    if (svgElement) {
        // Get the bounding box of the SVG elements (not the viewBox)
        const bbox = svgElement.bbox();
        const centerX = bbox.cx;
        const centerY = bbox.cy;

        // Apply the scaling transformation around the center of the bounding box
        svgElement.transform({
            scaleX: svgScale,
            scaleY: svgScale,
            originX: centerX,
            originY: centerY
        });
    }
}

// Function to handle the scale slider input and apply the scaling transformation
document.getElementById('scaleSlider').addEventListener('input', (event) => {
    const newScale = parseFloat(event.target.value);
    const svgElement = SVG('#svg-container').findOne('svg');

    if (svgElement) {
        // Calculate the scaling factor relative to the center of the SVG's bounding box
        const bbox = svgElement.bbox();
        const centerX = bbox.cx;
        const centerY = bbox.cy;

        // Adjust translation to keep the position relative to the new scale
        svgTranslateX = (svgTranslateX * newScale) / svgScale;
        svgTranslateY = (svgTranslateY * newScale) / svgScale;

        // Update the scale value
        svgScale = newScale;

        // Apply both scale and translation transformations
        applyTransformations();
    }
});

// Unified function to apply both scaling and translation transformations
function applyTransformations() {
    const svgElement = SVG('#svg-container').findOne('svg');
    if (svgElement) {
        const bbox = svgElement.bbox();
        const centerX = bbox.cx;
        const centerY = bbox.cy;

        // Apply both scale and translation transformations around the center of the bounding box
        svgElement.transform({
            scaleX: svgScale,
            scaleY: svgScale,
            translateX: svgTranslateX,
            translateY: svgTranslateY,
            originX: centerX,
            originY: centerY
        });
    }
}
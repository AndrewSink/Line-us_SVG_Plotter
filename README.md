# Line-us SVG Plotter
Browser-based interface for the [Line-us](https://www.line-us.com/) drawing robot.

Unfortunately, Line-us [doesn't support wss](https://github.com/Line-us/Line-us-Programming?tab=readme-ov-file#websockets-connection) (whoops!). You'll need to download all files, unzip, and run a local server to upload files. 

<img width="600" alt="Line-us SVG Plotter interface" src="https://github.com/user-attachments/assets/14f33888-74cc-4f71-b41e-e0ec3d75271f">

Inspired by the [LineUs_SVG](https://github.com/ixd-hof/LineUs_SVG/) plotter by [ixd-hof](https://github.com/ixd-hof), but written for ~the web~ a local server with no Processing knowledge required!

## Usage
1. Download and unzip all files
2. Run a local server
3. Wait for the Line-us to connect (status indicator will change once connected)
4. Upload an SVG (make sure it contains paths)
5. Move, scale, and position the SVG on the canvas
6. Click 'Plot' to start the Line-us!

## To-do
- [ ] Generate paths automatically
- [ ] Fix scaling
- [ ] Add simple text / drawing functionality?

Unforunately, the arm on my Line-us broke ([apparently a common problem](https://forum.line-us.com/t/arm-broken-drawings/406)), so I'm probably not going to be able to update this much further. Pull requests welcome, or just fork and make your own!

<img width="600" alt="Line-us" src="https://github.com/user-attachments/assets/04a82da3-7f45-495b-be3f-1c9b8fa97fa3">

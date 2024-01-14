const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d');
const double_touch_time = 500; //ms 
const hold_touch_time = 1000; //ms

//grid and scale
const grid_rows = 40;
const grid_columns = 60;
let grid_pixels = Math.floor(Math.min(window.innerWidth / grid_columns, window.innerHeight / grid_rows) );

//Array for grid components
let components = [];
let wires = [];

//Canvas size and update on change to browser window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
})

//Classes
class Wire {
  constructor (start_component) {
    this.points = [];
    this.linked_components = [start_component];
    this.in_construction = true;
    start_component.getWirePoints().forEach(point => {
      this.points.push(new LinePoint(point.row,point.column,this.points));
    });
  }
  draw(ctx) {
    this.points.forEach(point => {
      point.draw(ctx);
    });
    ctx.beginPath();
    ctx.moveTo((this.points[0].column + 0.5) * grid_pixels, (this.points[0].row + 0.5) * grid_pixels);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo((this.points[i].column + 0.5) * grid_pixels, (this.points[i].row + 0.5) * grid_pixels);
    }
    ctx.strokeStyle = "red";
    ctx.stroke();
  }
  touchStart = (e) => {
    this.points[this.points.length-1].touchStart(e);
  }
  touchMove = (e) => {
    this.points[this.points.length-1].touchMove(e);
  }
  touchEnd = (e) => {
    this.points[this.points.length-1].touchEnd(e);
  }
}

class Component { //base clase for canvas items
  constructor(row, column, componentsArray) {
    this.row = row;
    this.column = column;
    this.componentsArray = componentsArray;
    this.x = column * grid_pixels;
    this.y = row * grid_pixels;
    this.width = 2;
    this.height = 2;
    this.selected = false;
    this.color = 'red';
    this.selected_time = 0; //time object was last selected - used to detect double touch
    this.was_moved = false; //Flag if object was moved during touch event
    this.xoffset = undefined; //Offset for difference between top left and actual touch position.
    this.yoffset = undefined; 
    this.touchidentifier = undefined;
  }
  //move draw to specific component classes TODO
  draw(ctx) {
    if (this.selected) {
      ctx.fillStyle = 'white';
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fillRect(this.x,this.y,this.width*grid_pixels,this.height * grid_pixels);
    
  }
  select(touchx, touchy) {
    this.selected = true;
    this.xoffset = this.x - touchx;
    this.yoffset = this.y - touchy;
  }
  isClicked = (x, y) => {
    let testifclicked = (x > this.x && x < this.x + this.width * grid_pixels && y > this.y && y < this.y + this.height * grid_pixels);
    return testifclicked;
  }
  updatePosition(touchx, touchy) {
    let newColumn = Math.ceil((this.xoffset + touchx)/grid_pixels);
    let newRow = Math.ceil((this.yoffset + touchy)/grid_pixels);
    
    //set flag if moved
    if (newColumn !== this.column || newRow !== this.row) this.was_moved = true;
    
    if (newColumn < 0 || newRow < 0 || newColumn + this.width > grid_columns || newRow + this.height > grid_rows) {
      return;
    }
    const no_collision = -1;
    //Search componets and return first one with collision, -1 if no collision.
    let isCollision = this.componentsArray.findIndex(component => this.checkCollision(component,newColumn,newRow));
    
    if (isCollision === no_collision) {
      this.column = newColumn;
      this.row = newRow;
      this.x = this.column * grid_pixels;
      this.y = this.row * grid_pixels;
    }
  }
  touchStart = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      let touchx = e.changedTouches[i].pageX;
      let touchy = e.changedTouches[i].pageY;
      if(this.isClicked(touchx,touchy)){
        this.select(touchx, touchy);
        this.was_moved = false; //reset flag
        
        //Double touch detection
        
        let delta_time = e.timeStamp - this.selected_time;
        if (delta_time < double_touch_time ) {
          this.touchDoubleTap();
        } else {
          this.touchTap();
        }
        this.selected_time = e.timeStamp;
        this.touchidentifier = e.changedTouches[i].identifier;
      };
    }
  }
  touchMove = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchidentifier) {
        let touchx = e.changedTouches[i].pageX;
        let touchy = e.changedTouches[i].pageY;
        if (this.selected) this.updatePosition(touchx, touchy);
      }
    }
  }
  touchEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchidentifier) {
        if (this.selected) {
          this.selected = false;
          let delta_time = e.timeStamp - this.selected_time;
          if (this.was_moved === false && delta_time > hold_touch_time) this.touchHold();
        }
      }
    }
  }
  touchTap = () => {
    this.color = 'red';
  }
  touchDoubleTap = () => {
    this.color = 'green';
  }  
  touchHold = () => {
    this.color = 'blue';
  }
  checkCollision = (component, newColumn, newRow) => {
    return !(
      component.column > newColumn+this.width || 
      component.column + component.width < newColumn ||
      component.row > newRow + this.height ||
      component.row + component.height < newRow ||
      this === component
    )
  }
}

class Chip extends Component {
  constructor (row, column, components) {
    super(row, column, components);
    this.height = 6;
    this.width = 4;
  }
}

class Connector extends Component {
  constructor (row, column, components) {
    super(row, column, components);
    this.height = 3;
    this.width = 3;
    this.radius = 1;
    this.centre_offset = 1;
    this.second_point_offset = 4;
  }
  touchDoubleTap = () => {
    let wire = new Wire(this);
    wires.push(wire);
  }
  getWirePoints = () => {
    let point_one = {column: this.column + this.centre_offset, row: this.row + this.centre_offset};
    let point_two = {column: 0, row: 0};
    switch(this.getNearestSide()) {
      case 'left':
        point_two.column = point_one.column + this.second_point_offset;
        point_two.row = point_one.row;
        break;
      case 'right':
        point_two.column = point_one.column - this.second_point_offset;
        point_two.row = point_one.row;
        break;
      case 'top':
        point_two.column = point_one.column;
        point_two.row = point_one.row + this.second_point_offset;
        break;
      case 'bottom':
        point_two.column = point_one.column;
        point_two.row = point_one.row - this.second_point_offset;
        break;
    }
    return [point_one, point_two];
  }
  getNearestSide = () => {
    let left = this.column;
    let right = grid_columns - this.column;
    let top = this.row;
    let bottom = grid_rows - this.row;
    
    if (top < bottom && top < left && top < right) {
      return 'top';
    } else if (bottom < left && bottom < right) {
      return 'bottom';
    } else if (right < left) {
      return 'right';
    } else {
      return 'left';
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x + (this.width * 0.5 * grid_pixels) , this.y + (this.height * 0.5 * grid_pixels), this.radius * grid_pixels, 0, 2 * Math.PI);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

class LinePoint extends Component {
  constructor (row, column, components) {
    super(row, column, components);
    this.height = 1;
    this.width = 1;
  }
  touchStart = (e) => {
    let touchx = e.changedTouches[0].pageX;
    let touchy = e.changedTouches[0].pageY;
    this.select(touchx, touchy);
    this.was_moved = false; //reset flag
        
    //Double touch detection
    let delta_time = e.timeStamp - this.selected_time;
    if (delta_time < double_touch_time ) {
      this.touchDoubleTap();
    } else {
      this.touchTap();
    }
    this.selected_time = e.timeStamp;
    this.touchidentifier = e.changedTouches[0].identifier;
    console.log(this);
  }
  updatePosition = (touchx, touchy) => {
    let prev_point_row = components[components.length - 2].row;
    let prev_point_column = components[components.length - 2].column;
    
    if (this.column === prev_point_column) {
      super.updatePosition(this.x - this.xoffset, touchy);
    } else { //assume rows match
      super.updatePosition(touchx, this.y - this.yoffset);
    }
  // console.log(prev_point_column,this.);

  }
}

drawGrid = () => {
  //top, left added to allow future centering
  const top = 0;
  const left = 0;
  
  ctx.strokeStyle = "#202020";
  ctx.lineWidth = 2;

  for (let row = 0; row < grid_rows; row++) {
    for (let column = 0; column < grid_columns; column++) {
       ctx.strokeRect(grid_pixels * column, grid_pixels * row, grid_pixels, grid_pixels);
    }
  }
}

const testchips = [{row: 20, column: 20}, {row: 10, column: 10}];
const testconnectors = [{row: 5, column: 2}, {row: 10, column: 2}];

testchips.forEach(chip => (
  components.push(new Chip(chip.row,chip.column, components))
));

testconnectors.forEach(connector => (
  components.push(new Connector(connector.row,connector.column, components))
));


//Animation
function animate(){
  ctx.clearRect(0,0,canvas.width, canvas.height);
  drawGrid();
  components.forEach((component) => component.draw(ctx));
  wires.forEach((wire) => wire.draw(ctx));
  requestAnimationFrame(animate);
}

//Event Handlers
canvas.ontouchstart = (e) => {
  e.preventDefault();
  let selected_wire = wires.find(wire => wire.in_construction);
  if (selected_wire) {
    selected_wire.touchStart(e);
  } else {
    components.forEach((component) => component.touchStart(e));
  }
};

canvas.ontouchmove = (e) => {
  e.preventDefault();
  let selected_wire = wires.find(wire => wire.in_construction);
  if (selected_wire) {
    selected_wire.touchMove(e);
  } else {
    components.forEach((component) => component.touchMove(e));
  }
};

canvas.ontouchend = (e) => {
  e.preventDefault();
  let selected_wire = wires.find(wire => wire.in_construction);
  if (selected_wire) {
    selected_wire.touchEnd(e);
  } else {
    components.forEach((component) => component.touchEnd(e));
  }
};

animate();
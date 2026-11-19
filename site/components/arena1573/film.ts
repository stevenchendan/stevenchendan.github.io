// Positions and sight lines are authored together in the model's metre grid.
// Each cut starts a new camera move; the camera never flies through an arena wall.
type Triplet = [number,number,number];
type Chapter = {title:string;venue:string;seconds:number;from:Triplet;to:Triplet;look:Triplet;lookTo:Triplet;fov:number};
export const film:Chapter[]=[
  {title:'墨尔本公园',venue:'all',seconds:7,from:[-110,185,310],to:[-45,152,274],look:[131,4,31],lookTo:[142,7,41],fov:42},
  {title:'铜色屋顶',venue:'mca',seconds:6,from:[-11,68,78],to:[8,58,84],look:[65,13,21],lookTo:[69,13,25],fov:43},
  {title:'罗德·拉沃尔球场',venue:'rla',seconds:6,from:[169,10,109],to:[164,9.3,105],look:[154,2,70],lookTo:[153,1.6,70],fov:46},
  {title:'底线回合',venue:'1573',seconds:7,from:[-8,16,36],to:[-5,14.5,32],look:[0,.6,0],lookTo:[0,.7,-1],fov:45},
  {title:'约翰·凯因球场',venue:'john',seconds:7,from:[396,109,263],to:[404,133,283],look:[459,11,166],lookTo:[456,11,162],fov:42},
];

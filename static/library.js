// Global Variables
var SelectedIcon = null;    // Used to assign an Icon from the canvas to the table map
var columns = 26;           // columns of the table, in HeroQuest is standard but I kept it to create a dynamic table
var rows = 19;              // rows of the table, in HeroQuest is standard but I kept it to create a dynamic table
var rotations = ["rotate-0","rotate-90","rotate-180","rotate-270"]; // object rotations, I wish there were itertools in Javascript but this can do with some controls


// Function to load the table map
// By default it requires in input data from flask to construct the empty board base (BoardData) containing all the rooms and corridors and borders
// Optionally it takes overlay map data from a loaded map (MapData), if empty it will just create an empty table
function TableBoard(BoardData,MapData="")
{
    // Instantiate the object table by its ID (used also for CSS formatting)
    // and add a click event listener to the whole table (not for each single cell!)
    // NOTE: events in JavaScript triggers automatically the function that is attached to it
    // This means that function(event) is an "anonymous" function that is used to collect the "event" object
    // that is the object that triggers the event.
    // the anonymous function then passes the event object that is used to the inner function {select2(event.target.id)}
    // and this last function is then executed only when the event occurs and not when the event listener is added.
    // assigning directly {select2(event.target.id)} as event listener would execute the inner function as soon as the event listener
    // is added and thus it would not work as expected.
    let tableObj = document.getElementById('table');
    tableObj.addEventListener('click', function(event){select2(event.target.id)});

    // letters that will be used to build each cell ID of the table
    var letters = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // Here we build the GRID table (refer to the CSS file where table is defined with display:grid)
    // GRID tables are defined with a set of row and columns at the CSS definition but their body is built of
    // an "array" of DIVs
    // This means that even if there are two nested for loops, these are used only to process Letters and numbers
    // to generate consistent IDs (A1,A2...B1,B2,..)
    // Each cell consists of 3 layers: monster/furniture/tile as layer1/layer2/layer3
    // the reason for this is because each cell can host multiple information (e.g:a monster on a tile with a door as furniture)
    // and each of those have an order of representation defined in the CSS via order attribute (furniture->monster->tile)
    //
    for(var i=1; i<=rows; i++)
    {
        for(var j=1; j<=columns; j++)
        {
            // Create all the DIV layers
            var monster = document.createElement("div");
            monster.id = "layer1";
            var furniture = document.createElement("div");
            furniture.id = "layer2";
            var tile = document.createElement("div");
            tile.id = "layer3";
            // Create the DIV cell and add the previous layers as its child
            var cell = document.createElement("div");
            cell.appendChild(monster);
            cell.appendChild(furniture);
            cell.appendChild(tile);
            // retrieve the cell table data from the input array of dictionaries from Flask
            // each of these information are added as CSS classes to each cell
            // CSS classes contains graphical informations (color, border, etc)
            // b stands for borders (l:left r:right t:top b:bottom)
            // t stands for type (room or corridor)
            // r stands for room number (future use)
            CellData = BoardData[i-1][j-1];
            cell.classList.add("cell");
            cell.classList.add(CellData["t"]);
            for(border of CellData.b) // CellData.b or CellData["b"] are equivalent
            {
                if (border == "l")
                {
                    cell.classList.add("border-left");
                }
                else if (border == "r")
                {
                    cell.classList.add("border-right");
                }
                else if (border == "t")
                {
                    cell.classList.add("border-top");
                }
                else if (border == "b")
                {
                    cell.classList.add("border-bottom");
                }
            }
            cell.id = letters[i] + j; // build and assign ID to the cell
            tableObj.appendChild(cell) // add the cell to the table (recall that grid tables in CSS contains an array of cells)
        }

    }
    // If MapData is populated it means that we are loading a map from the database
    if (MapData != "")
    {
        // MapData contains cells information in the dictionary entry "cells"
        // cells contains the array of Table Grid as it was saved by the SendMapData function
        // to retrieve  the data is necessary to parse to JSON the array contained in the dictionery "cells"
        var parsedCellsData = JSON.parse(MapData["cells"])
        // Here we assign the cells data parsed from MapData in JSON to the Table object
        // starts from index i=1 because in JavaScript the data at index i=0 is the base table data "BoardData"
        // and the cells attached to the Table object starts from 1
        for(var i=1; i<tableObj.children.length; i++)
        {
            tableObj.children[i].innerHTML = parsedCellsData[i-1];
        }
        // here we populate the rest of the metadata on each element at screen
        document.getElementById('title').value = MapData["title"];
        document.getElementById('author').value = MapData["author"];
        document.getElementById('story').value = MapData["story"];
        document.getElementById('notes').value = MapData["notes"];
        document.getElementById('WM').innerHTML = MapData["wmonster"];
    }
}


// This function handles the selection of elements on the canvas and on the table map and on the wandering monster cell
// each canvas or table map or wandering monster has a specific ID assigned
// the function looks for the root ID of the container of the cell element selected and behaves accordingly:
// canvas : highlight the selected cell (via CSS class) and save the content of the selection in the SelectedIcon variable
// table : verify if SelectedIcon is populated (so a previous selection was done) and assign the data to the correct layer based
//         on the data of the selected cell (so the CSS class)
//         if the same selection and the selected entry allows, it will rotate the icon (for furniture/doors/tiles, not for monsters)
// tablewm : means that we are assigning data to the mini table with a single cell representing the wandering monster
//           in this case we verify that only a monster can be assigned to it.
function select2(id)
{
    // element ID is passed in input via the calling function
    var element = document.getElementById(id);
    // here we determine which is the parent Element to change the function behavior accordingly
    const root = element.parentElement;

    if (root.id == "canvas")
    {
        // remove the highlight from all canvas cells
        for (cell of root.children)
            {
                cell.classList.remove("td-selected");

            }
        // add the highlight to the selected canvas cell
        element.classList.add("td-selected");
        // Special Case: delete cell, if selected SelectedIcon will be set to null, this will be handled later
        if (element.classList.contains("delete"))
        {
            SelectedIcon = null;
        }
        else
        {
            //CloneNode returns a copy of the original node, otherwise it would modify also the canvas
            SelectedIcon = element.cloneNode(deep=true);
        }
    }

    if (root.id == "table")
        // SelectedIcon is null only if we selected "delete" from canvas
        if (SelectedIcon != null)
        {
            // Table cell layer selector based on the canvas item category
            if (SelectedIcon.classList.contains("monster") || SelectedIcon.classList.contains("helper"))
            {
                var layer = 0;
            }
            else if (SelectedIcon.classList.contains("furniture"))
            {
                var layer = 1;
            }
            else if (SelectedIcon.classList.contains("tile"))
            {
                var layer = 2;
            }
            // if the table cell is empty or the selection is a monster or an helper set the rotation to 0 and assign the selected icon data to the cell
            // NOTE: this assignment is the reason why before we made a "copy" of the selected cavas entry
            if ((element.children[layer].innerHTML == "") || SelectedIcon.classList.contains("monster") || SelectedIcon.classList.contains("helper"))
            {
                SelectedIcon.children[0].classList.add(rotations[0]);
                element.children[layer].innerHTML = SelectedIcon.innerHTML;
            }
            // if we selected furniture or a tile on the canvas and the table cell is not empty
            // first we find the current rotation
            // then assign the next rotation entry in the array of rotations (itertools may have helped)
            else if (SelectedIcon.classList.contains("furniture") || SelectedIcon.classList.contains("tile"))
            {
                // find the current rotation
                var CurrentRotation = null;
                for (rotation of rotations)
                {
                    if (element.children[layer].firstChild.classList.contains(rotation))
                    {
                        CurrentRotation = rotation;
                        break;
                    }
                }
                // assign the next rotation and circle it back to the beginning if we are past the last rotation
                var index = rotations.indexOf(CurrentRotation)
                if ((index == -1) || (index == rotations.length -1))
                {
                    var NewRotation = rotations[0];
                }
                else
                {
                    var NewRotation = rotations[index+1]
                }

                if (CurrentRotation != null)
                {
                    SelectedIcon.children[0].classList.remove(CurrentRotation);
                }
                SelectedIcon.children[0].classList.add(NewRotation);
                element.children[layer].innerHTML = SelectedIcon.innerHTML;
                SelectedIcon.children[0].classList.remove(NewRotation);
            }
        }
        // this case we consider we have assigned the delete selection, so we erase to an empty string
        // each inner layer of the cell
        else
        {
            for (child of element.children)
            {
                child.innerHTML = "";
            }
        }
    // here we assign only a monster to the wandering monster small table
    if (root.id == "tablewm")
        if (SelectedIcon != null)
        {
            // Table cell layer selector based on the canvas item category
            if (SelectedIcon.classList.contains("monster") || SelectedIcon.classList.contains("helper"))
            {
                var layer = 0;
            }
            if (SelectedIcon.classList.contains("monster"))
            {
                SelectedIcon.children[0].classList.add(rotations[0]);
                element.children[layer].innerHTML = SelectedIcon.innerHTML;
            }
        }
}

// this function saves the Map data by sending it to the backend Flask application
function SendMapData()
{
    // collect all the necessary objects from the page
    let tableObj = document.getElementById('table');
    let tileobj = document.getElementById('title');
    let authorobj = document.getElementById('author');
    let storyobj = document.getElementById('story');
    let notesobj = document.getElementById('notes');
    let WMobj = document.getElementById('WM');

    // define the data structure to contain all the table map cell data and metadata
    let table = {
        title : tileobj.value,
        author : authorobj.value,
        story : storyobj.value,
        notes : notesobj.value,
        wm : WMobj.innerHTML,
        cells : ""
    };

    // populate an array with all the data from the children of the table (meaning the cells)
    // next assign convert the JSON array to a string via JSON.stringify and assign it to the table.cells
    // having the array as a string will ease the saving of the cells information in a single entry in the backend database
    for(var arr=[], i=1; i<tableObj.children.length; i++)
        {
            arr.push(tableObj.children[i].innerHTML);
        }
    table.cells = JSON.stringify(arr);

    // source: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
    // This is an AJAX call to send map data to the flask backend without having to refresh the page
    // is relevant to use such function in this context because data could be lost during page swaps or
    // because of any error, AJAX calls instead allows for the exchange of data (send in this case but also for retrieval)
    // without having to load another page via a form submit
    // NOTE: AJAX could have been used for loading a MAP as well but as a design choice I considered a better approach to use
    // a form submit from another "loading" page

    // define the AJAX XMLHttpRequest object
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/savemap", true); // define the operation: POST to /savemap url in Asynchronous mode

    // Send the proper header information along with the request, as we are exchanging JSON data
    xhr.setRequestHeader("Content-Type", "application/json");

    // Event triggered when changes of state occurs (by returning status codes from flask)
    // Flask application returns
    // 201 -> for a new map
    // 204 -> for the update of an existing map
    // these codes are used to inform the user via an alert box
    xhr.onreadystatechange = () => {
      // Call a function when the state changes.
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status == 201)
        {
            alert("Map Created")
        }
        if (xhr.status == 204)
        {
            alert("Map updated")
        }
      }
    };

    // This actually sends the request to flask backend via the /sendmap defined POST operation earlier
    // converts to string the JSON data structure table containing all the data to save from the current map
    xhr.send(JSON.stringify(table));
}

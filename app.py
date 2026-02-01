import os
import json
import datetime
import pytz

from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, session
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash

from functools import wraps


# Version
version = "1.0"

# Configure application
app = Flask(__name__)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///db/hqbuilder.db")

# Configure session to use filesystem (instead of signed cookies)
# SECRET_KEY securely signs the session cookie 
# https://flask.palletsprojects.com/en/3.0.x/config/#SECRET_KEY
# https://blog.paradoxis.nl/defeating-flasks-session-management-65706ba9d3ce
app.config["SECRET_KEY"] = os.urandom(64)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

def login_required(f):
    """
    Decorate routes to require login.

    https://flask.palletsprojects.com/en/latest/patterns/viewdecorators/
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect("/login")
        return f(*args, **kwargs)

    return decorated_function

@app.after_request
def after_request(response):
    """Ensure responses aren't cached"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response

#b stands for borders (l:left r:right t:top b:bottom)
#t stands for type (room or corridor)
#r stands for room number (future use)

board_data = [
    [{"b":[],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["r","t"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["r","t"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l","t"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b"],"t":"corridor","r":""},{"b":["b","t"],"t":"corridor","r":""},{"b":["b","t"],"t":"corridor","r":""},{"b":["r","t"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l","r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l","r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":[],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["r","t"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["r","l"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l","b"],"t":"corridor","r":""},{"b":["b","t"],"t":"corridor","r":""},{"b":["b","t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["t","b"],"t":"corridor","r":""},{"b":["b","r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["r","b"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["t","l"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t","r"],"t":"room","r":""},{"b":["l","t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["t"],"t":"room","r":""},{"b":["r","t"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":[],"t":"room","r":""},{"b":["r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":["r"],"t":"corridor","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l","b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""},{"b":["r"],"t":"corridor","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["b","l"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b"],"t":"room","r":""},{"b":["b","r"],"t":"room","r":""},{"b":["l"],"t":"corridor","r":""}],
    [{"b":[],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":["t"],"t":"corridor","r":""},{"b":[],"t":"corridor","r":""}],
]

@app.route("/", methods=["GET","POST"])
@login_required
def index(mapdatainput=""):
    if request.method == "POST":
        mapdatainput = db.execute(
        "SELECT title,author,story,notes,wmonster,cells FROM maps WHERE id=?;",
        request.form.get("id")
        )[0]
    return render_template("createmap.html",BoardDataInput = board_data,MapDataInput=mapdatainput)

@app.route("/credits", methods=["GET"])
@login_required
def credits():
    return render_template("credits.html",version=version)

@app.route("/savemap", methods=["POST"])
@login_required
def savemap():
    # mapdata is a dictionary that contains information for a map in the following keys
    # title
    # author
    # story
    # notes
    # wm (wandering monster)
    # cells (all cells content as text but needs to be converted as an array in javascript)
    mapdata = request.get_json()


    date = datetime.datetime.now(pytz.timezone("US/Eastern"))

    # Verify that the map with the same title and user and author exists already
    existing_map = db.execute(
    "SELECT id FROM maps WHERE user_id=? AND title=? AND author=?;",
    session["user_id"],
    mapdata["title"],
    mapdata["author"]
    )


    if existing_map:
        # update map with current data on the existing ID
        db.execute(
            "UPDATE maps SET story=?,notes=?,wmonster=?,cells=?,date=? WHERE id=?",
            mapdata["story"],
            mapdata["notes"],
            mapdata["wm"],
            mapdata["cells"],
            date,
            existing_map[0]["id"],
        )
        status_code = 204
    else:
        # Add map data into maps table as a new entry (map does not exist already)
        db.execute(
            "INSERT INTO maps (user_id,title,author,story,notes,wmonster,cells,date) VALUES (?,?,?,?,?,?,?,?)",
            session["user_id"],
            mapdata["title"],
            mapdata["author"],
            mapdata["story"],
            mapdata["notes"],
            mapdata["wm"],
            mapdata["cells"],
            date,
        )
        status_code = 201
    return json.dumps({'success':True}), status_code, {'ContentType':'application/json'} # return positive outcome to Ajax without rendering any new page

@app.route("/loadmap", methods=["GET"])
@login_required
def loadmap():
    if request.method == "GET":
        maplist = db.execute(
        "SELECT id,title,author FROM maps WHERE user_id=?;",
        session["user_id"]
        )
        app.logger.info(maplist)
        return render_template("loadmap.html",maplist=maplist)

@app.route("/delete", methods=["POST"])
@login_required
def deletemap():
    if request.method == "POST":
        app.logger.info("map id: "+request.form.get("id"))
        db.execute(
            "DELETE FROM maps WHERE id=?;",
            request.form.get("id"),
        )
        return redirect("/loadmap")

@app.route("/login", methods=["GET", "POST"])
def login():
    """Log user in"""

    # Forget any user_id
    session.clear()

    # User reached route via POST (as by submitting a form via POST)
    if request.method == "POST":
        # Ensure username was submitted
        if not request.form.get("username"):
            return render_template("message.html",message="must provide username"), 400

        # Ensure password was submitted
        elif not request.form.get("password"):
            return render_template("message.html",message="must provide password"), 400

        # Query database for username
        rows = db.execute(
            "SELECT * FROM users WHERE username = ?", request.form.get("username")
        )

        # Ensure username exists and password is correct
        if len(rows) != 1 or not check_password_hash(
            rows[0]["hash"], request.form.get("password")
        ):
            return render_template("message.html",message="invalid username and/or password"), 400

        # Remember which user has logged in
        session["user_id"] = rows[0]["id"]

        # Redirect user to home page
        return redirect("/")

    # User reached route via GET (as by clicking a link or via redirect)
    else:
        return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """Register user"""
    if request.method == "POST":
        if not request.form.get("username"):  # check for username
            return render_template("message.html",message="must provide username"), 400
        elif not request.form.get("password"):  # check for password
            return render_template("message.html",message="must provide password"), 400
        elif not request.form.get("confirmpassword"):  # check for password confirmation
            return render_template("message.html",message="must provide password confirmation!"), 400
        elif request.form.get("confirmpassword") != request.form.get("password"):  # check if password and confirmation matches
            return render_template("message.html",message="passwords must match!"), 400

        username = request.form.get("username")
        username_query = db.execute(
            "SELECT * FROM users WHERE username=?", username
        )  # retrieve data on specific username
        if username_query:  # check if username already exists
            return render_template("message.html",message="Username Already exists!"), 400
        password_hash = generate_password_hash(request.form.get("password"))
        db.execute(
            "INSERT INTO users (username,hash) VALUES (?,?)", username, password_hash
        )

        return render_template("message.html",message="Registration Successful!")

    else:
        # logout any current user
        session.clear()
        return render_template("register.html")


@app.route("/logout")
def logout():
    """Log user out"""

    # Forget any user_id
    session.clear()

    # Redirect user to login form
    return redirect("/")

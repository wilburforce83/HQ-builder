import os
import io
import json
import time
import uuid
import datetime
import pytz

from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, session, send_from_directory, jsonify, abort, send_file
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

def init_card_tables():
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY NOT NULL,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            blob BLOB NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY NOT NULL,
            user_id INTEGER NOT NULL,
            template_id TEXT NOT NULL,
            status TEXT NOT NULL,
            name TEXT NOT NULL,
            name_lower TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            schema_version INTEGER NOT NULL,
            title TEXT,
            description TEXT,
            image_asset_id TEXT,
            image_asset_name TEXT,
            image_scale REAL,
            image_offset_x REAL,
            image_offset_y REAL,
            image_original_width REAL,
            image_original_height REAL,
            hero_attack_dice INTEGER,
            hero_defend_dice INTEGER,
            hero_body_points INTEGER,
            hero_mind_points INTEGER,
            monster_movement_squares INTEGER,
            monster_attack_dice INTEGER,
            monster_defend_dice INTEGER,
            monster_body_points INTEGER,
            monster_mind_points INTEGER,
            monster_icon_asset_id TEXT,
            monster_icon_asset_name TEXT,
            thumbnail_data_url TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY NOT NULL,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            card_ids TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            schema_version INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS quest_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            user_id INTEGER NOT NULL,
            map_id INTEGER NOT NULL,
            card_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(map_id) REFERENCES maps(id),
            FOREIGN KEY(card_id) REFERENCES cards(id)
        );
        """
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_cards_user_name_lower ON cards(user_id, name_lower);")
    db.execute("CREATE INDEX IF NOT EXISTS idx_cards_user_template_status ON cards(user_id, template_id, status);")
    db.execute("CREATE INDEX IF NOT EXISTS idx_assets_user_created_at ON assets(user_id, created_at);")
    db.execute("CREATE INDEX IF NOT EXISTS idx_collections_user_name ON collections(user_id, name);")

init_card_tables()

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


CARD_BUILDER_DIR = os.path.join(os.path.dirname(__file__), "card-builder", "out")

def _now_ms():
    return int(time.time() * 1000)

def _card_row_to_dict(row):
    return {
        "id": row["id"],
        "templateId": row["template_id"],
        "status": row["status"],
        "name": row["name"],
        "nameLower": row["name_lower"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "schemaVersion": row["schema_version"],
        "title": row["title"],
        "description": row["description"],
        "imageAssetId": row["image_asset_id"],
        "imageAssetName": row["image_asset_name"],
        "imageScale": row["image_scale"],
        "imageOffsetX": row["image_offset_x"],
        "imageOffsetY": row["image_offset_y"],
        "imageOriginalWidth": row["image_original_width"],
        "imageOriginalHeight": row["image_original_height"],
        "heroAttackDice": row["hero_attack_dice"],
        "heroDefendDice": row["hero_defend_dice"],
        "heroBodyPoints": row["hero_body_points"],
        "heroMindPoints": row["hero_mind_points"],
        "monsterMovementSquares": row["monster_movement_squares"],
        "monsterAttackDice": row["monster_attack_dice"],
        "monsterDefendDice": row["monster_defend_dice"],
        "monsterBodyPoints": row["monster_body_points"],
        "monsterMindPoints": row["monster_mind_points"],
        "monsterIconAssetId": row["monster_icon_asset_id"],
        "monsterIconAssetName": row["monster_icon_asset_name"],
        "thumbnailDataUrl": row["thumbnail_data_url"],
    }

def _collection_row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "cardIds": json.loads(row["card_ids"]) if row["card_ids"] else [],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "schemaVersion": row["schema_version"],
    }

def _asset_row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "mimeType": row["mime_type"],
        "width": row["width"],
        "height": row["height"],
        "createdAt": row["created_at"],
    }

@app.route("/cards", defaults={"path": ""})
@app.route("/cards/<path:path>")
@login_required
def card_builder(path):
    if not os.path.isdir(CARD_BUILDER_DIR):
        return render_template(
            "message.html",
            message="Card builder not built. Run: cd card-builder && npm install && npm run build",
        ), 500

    if path == "" or path.endswith("/"):
        path = "index.html"

    full_path = os.path.join(CARD_BUILDER_DIR, path)
    if os.path.isfile(full_path):
        return send_from_directory(CARD_BUILDER_DIR, path)

    # SPA fallback for client-side routing
    return send_from_directory(CARD_BUILDER_DIR, "index.html")

@app.route("/api/cards", methods=["GET"])
@login_required
def api_list_cards():
    template_id = request.args.get("templateId")
    status = request.args.get("status")
    search = request.args.get("search")

    query = "SELECT * FROM cards WHERE user_id=?"
    params = [session["user_id"]]

    if template_id:
        query += " AND template_id=?"
        params.append(template_id)
    if status:
        query += " AND status=?"
        params.append(status)
    if search:
        query += " AND name_lower LIKE ?"
        params.append(f"%{search.lower()}%")

    query += " ORDER BY updated_at DESC"

    rows = db.execute(query, *params)
    return jsonify([_card_row_to_dict(row) for row in rows])

@app.route("/api/cards", methods=["POST"])
@login_required
def api_create_card():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    card_id = data.get("id") or uuid.uuid4().hex
    name = data.get("name")
    template_id = data.get("templateId")
    status = data.get("status")
    if not name or not template_id or not status:
        return jsonify({"error": "Missing required fields"}), 400

    now_ms = _now_ms()
    created_at = data.get("createdAt") or now_ms
    updated_at = data.get("updatedAt") or now_ms
    schema_version = data.get("schemaVersion") or 1
    name_lower = data.get("nameLower") or name.lower()

    db.execute(
        """
        INSERT OR REPLACE INTO cards (
            id,user_id,template_id,status,name,name_lower,created_at,updated_at,schema_version,
            title,description,image_asset_id,image_asset_name,image_scale,image_offset_x,image_offset_y,
            image_original_width,image_original_height,hero_attack_dice,hero_defend_dice,hero_body_points,
            hero_mind_points,monster_movement_squares,monster_attack_dice,monster_defend_dice,
            monster_body_points,monster_mind_points,monster_icon_asset_id,monster_icon_asset_name,
            thumbnail_data_url
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        card_id,
        session["user_id"],
        template_id,
        status,
        name,
        name_lower,
        created_at,
        updated_at,
        schema_version,
        data.get("title"),
        data.get("description"),
        data.get("imageAssetId"),
        data.get("imageAssetName"),
        data.get("imageScale"),
        data.get("imageOffsetX"),
        data.get("imageOffsetY"),
        data.get("imageOriginalWidth"),
        data.get("imageOriginalHeight"),
        data.get("heroAttackDice"),
        data.get("heroDefendDice"),
        data.get("heroBodyPoints"),
        data.get("heroMindPoints"),
        data.get("monsterMovementSquares"),
        data.get("monsterAttackDice"),
        data.get("monsterDefendDice"),
        data.get("monsterBodyPoints"),
        data.get("monsterMindPoints"),
        data.get("monsterIconAssetId"),
        data.get("monsterIconAssetName"),
        data.get("thumbnailDataUrl"),
    )

    rows = db.execute(
        "SELECT * FROM cards WHERE id=? AND user_id=?",
        card_id,
        session["user_id"],
    )
    if not rows:
        return jsonify({"error": "Failed to create card"}), 500
    return jsonify(_card_row_to_dict(rows[0])), 201

@app.route("/api/cards/<card_id>", methods=["GET"])
@login_required
def api_get_card(card_id):
    rows = db.execute(
        "SELECT * FROM cards WHERE id=? AND user_id=?",
        card_id,
        session["user_id"],
    )
    if not rows:
        return jsonify({"error": "Not found"}), 404
    return jsonify(_card_row_to_dict(rows[0]))

@app.route("/api/cards/<card_id>", methods=["PUT"])
@login_required
def api_update_card(card_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    rows = db.execute(
        "SELECT id FROM cards WHERE id=? AND user_id=?",
        card_id,
        session["user_id"],
    )
    if not rows:
        return jsonify({"error": "Not found"}), 404

    field_map = {
        "templateId": "template_id",
        "status": "status",
        "name": "name",
        "nameLower": "name_lower",
        "title": "title",
        "description": "description",
        "imageAssetId": "image_asset_id",
        "imageAssetName": "image_asset_name",
        "imageScale": "image_scale",
        "imageOffsetX": "image_offset_x",
        "imageOffsetY": "image_offset_y",
        "imageOriginalWidth": "image_original_width",
        "imageOriginalHeight": "image_original_height",
        "heroAttackDice": "hero_attack_dice",
        "heroDefendDice": "hero_defend_dice",
        "heroBodyPoints": "hero_body_points",
        "heroMindPoints": "hero_mind_points",
        "monsterMovementSquares": "monster_movement_squares",
        "monsterAttackDice": "monster_attack_dice",
        "monsterDefendDice": "monster_defend_dice",
        "monsterBodyPoints": "monster_body_points",
        "monsterMindPoints": "monster_mind_points",
        "monsterIconAssetId": "monster_icon_asset_id",
        "monsterIconAssetName": "monster_icon_asset_name",
        "thumbnailDataUrl": "thumbnail_data_url",
        "schemaVersion": "schema_version",
        "createdAt": "created_at",
    }

    updates = []
    params = []
    if "name" in data and "nameLower" not in data:
        data["nameLower"] = data["name"].lower()

    for key, col in field_map.items():
        if key in data:
            updates.append(f"{col}=?")
            params.append(data.get(key))

    updates.append("updated_at=?")
    params.append(_now_ms())

    params.append(session["user_id"])
    params.append(card_id)

    db.execute(
        f"UPDATE cards SET {', '.join(updates)} WHERE user_id=? AND id=?",
        *params,
    )

    updated = db.execute(
        "SELECT * FROM cards WHERE id=? AND user_id=?",
        card_id,
        session["user_id"],
    )
    return jsonify(_card_row_to_dict(updated[0]))

@app.route("/api/cards/<card_id>", methods=["DELETE"])
@login_required
def api_delete_card(card_id):
    db.execute(
        "DELETE FROM cards WHERE id=? AND user_id=?",
        card_id,
        session["user_id"],
    )
    return jsonify({"success": True})

@app.route("/api/cards", methods=["DELETE"])
@login_required
def api_delete_cards_bulk():
    data = request.get_json(silent=True)
    if not data or "ids" not in data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    ids = data.get("ids") or []
    if not ids:
        return jsonify({"success": True, "deleted": 0})
    placeholders = ",".join(["?"] * len(ids))
    db.execute(
        f"DELETE FROM cards WHERE user_id=? AND id IN ({placeholders})",
        session["user_id"],
        *ids,
    )
    return jsonify({"success": True, "deleted": len(ids)})

@app.route("/api/assets", methods=["GET"])
@login_required
def api_list_assets():
    rows = db.execute(
        "SELECT id,name,mime_type,width,height,created_at FROM assets WHERE user_id=? ORDER BY created_at DESC",
        session["user_id"],
    )
    return jsonify([_asset_row_to_dict(row) for row in rows])

@app.route("/api/assets", methods=["POST"])
@login_required
def api_add_asset():
    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "Missing file upload"}), 400

    asset_id = request.form.get("id") or uuid.uuid4().hex
    name = request.form.get("name") or upload.filename
    mime_type = request.form.get("mimeType") or upload.mimetype or "application/octet-stream"
    width = request.form.get("width")
    height = request.form.get("height")

    if not name or width is None or height is None:
        return jsonify({"error": "Missing metadata"}), 400

    try:
        width_val = int(width)
        height_val = int(height)
    except ValueError:
        return jsonify({"error": "Invalid width/height"}), 400

    blob = upload.read()
    created_at = _now_ms()

    db.execute(
        """
        INSERT OR REPLACE INTO assets (
            id,user_id,name,mime_type,width,height,created_at,blob
        ) VALUES (?,?,?,?,?,?,?,?)
        """,
        asset_id,
        session["user_id"],
        name,
        mime_type,
        width_val,
        height_val,
        created_at,
        blob,
    )

    rows = db.execute(
        "SELECT id,name,mime_type,width,height,created_at FROM assets WHERE id=? AND user_id=?",
        asset_id,
        session["user_id"],
    )
    return jsonify(_asset_row_to_dict(rows[0])), 201

@app.route("/api/assets/<asset_id>/blob", methods=["GET"])
@login_required
def api_get_asset_blob(asset_id):
    rows = db.execute(
        "SELECT blob,mime_type,name FROM assets WHERE id=? AND user_id=?",
        asset_id,
        session["user_id"],
    )
    if not rows:
        return jsonify({"error": "Not found"}), 404
    blob = rows[0]["blob"]
    mime_type = rows[0]["mime_type"]
    name = rows[0]["name"] or f"{asset_id}.bin"
    return send_file(io.BytesIO(blob), mimetype=mime_type, download_name=name)

@app.route("/api/assets", methods=["DELETE"])
@login_required
def api_delete_assets_bulk():
    data = request.get_json(silent=True)
    if not data or "ids" not in data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    ids = data.get("ids") or []
    if not ids:
        return jsonify({"success": True, "deleted": 0})
    placeholders = ",".join(["?"] * len(ids))
    db.execute(
        f"DELETE FROM assets WHERE user_id=? AND id IN ({placeholders})",
        session["user_id"],
        *ids,
    )
    return jsonify({"success": True, "deleted": len(ids)})

@app.route("/api/collections", methods=["GET"])
@login_required
def api_list_collections():
    rows = db.execute(
        "SELECT * FROM collections WHERE user_id=? ORDER BY name COLLATE NOCASE",
        session["user_id"],
    )
    return jsonify([_collection_row_to_dict(row) for row in rows])

@app.route("/api/collections", methods=["POST"])
@login_required
def api_create_collection():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    name = data.get("name")
    if not name:
        return jsonify({"error": "Missing name"}), 400

    collection_id = data.get("id") or uuid.uuid4().hex
    now_ms = _now_ms()
    created_at = data.get("createdAt") or now_ms
    updated_at = data.get("updatedAt") or now_ms
    schema_version = data.get("schemaVersion") or 1
    card_ids = data.get("cardIds") or []

    db.execute(
        """
        INSERT OR REPLACE INTO collections (
            id,user_id,name,description,card_ids,created_at,updated_at,schema_version
        ) VALUES (?,?,?,?,?,?,?,?)
        """,
        collection_id,
        session["user_id"],
        name,
        data.get("description"),
        json.dumps(card_ids),
        created_at,
        updated_at,
        schema_version,
    )

    rows = db.execute(
        "SELECT * FROM collections WHERE id=? AND user_id=?",
        collection_id,
        session["user_id"],
    )
    return jsonify(_collection_row_to_dict(rows[0])), 201

@app.route("/api/collections/<collection_id>", methods=["PUT"])
@login_required
def api_update_collection(collection_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    rows = db.execute(
        "SELECT id FROM collections WHERE id=? AND user_id=?",
        collection_id,
        session["user_id"],
    )
    if not rows:
        return jsonify({"error": "Not found"}), 404

    updates = []
    params = []
    if "name" in data:
        updates.append("name=?")
        params.append(data.get("name"))
    if "description" in data:
        updates.append("description=?")
        params.append(data.get("description"))
    if "cardIds" in data:
        updates.append("card_ids=?")
        params.append(json.dumps(data.get("cardIds") or []))
    if "schemaVersion" in data:
        updates.append("schema_version=?")
        params.append(data.get("schemaVersion"))

    updates.append("updated_at=?")
    params.append(_now_ms())
    params.append(session["user_id"])
    params.append(collection_id)

    db.execute(
        f"UPDATE collections SET {', '.join(updates)} WHERE user_id=? AND id=?",
        *params,
    )

    updated = db.execute(
        "SELECT * FROM collections WHERE id=? AND user_id=?",
        collection_id,
        session["user_id"],
    )
    return jsonify(_collection_row_to_dict(updated[0]))

@app.route("/api/collections/<collection_id>", methods=["DELETE"])
@login_required
def api_delete_collection(collection_id):
    db.execute(
        "DELETE FROM collections WHERE id=? AND user_id=?",
        collection_id,
        session["user_id"],
    )
    return jsonify({"success": True})

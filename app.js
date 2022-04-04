import express from 'express';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import session from 'express-session'

const app = express();
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'notesapp'
});

// preparing to use the express-session package
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}))

app.use((req, res, next) => {
    if(req.session.userId === undefined){
        res.locals.isLoggedIn = false;
    } else {
        res.locals.isLoggedIn = true;
        res.locals.username = req.session.username;
    }
    next();
})

app.set('view engine', 'ejs');
app.use(express.static('public'));

// required configuration for accessing form values
app.use(express.urlencoded({extended: false}));

app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.get('/notes', (req, res) => {
    if(res.locals.isLoggedIn) {
        connection.query(
            'SELECT * FROM notes WHERE userID = ?', 
            [req.session.userId],
            (error, results) => {            
                res.render('notes.ejs', {notes: results})
            }
        );
    } else {
        res.redirect('/login');
    }
})

// viewing individual note (/:id) route parameter
app.get('/note/:id', (req, res) => {
    if(res.locals.isLoggedIn) {
        connection.query(
            'SELECT * FROM notes WHERE id = ? AND userID = ?', 
            [req.params.id, req.session.userId],
            (error, results) => {
                if(results.length > 0) {
                    res.render('single-note.ejs', {note: results[0]})
                } else {
                    res.redirect('/notes');
                }
            }
        );
    } else {
        res.redirect('/login');
    }
})


// display form to add new note
app.get('/create', (req, res) => {
    if(res.locals.isLoggedIn) {
        res.render('new-note.ejs');
    } else {
        res.redirect('/login')
    }
})

// add note to db
app.post('/create', (req, res) => {
    connection.query(
        'INSERT INTO notes (title, body, userID) VALUES (?,?,?)',
        [req.body.title, req.body.body, req.session.userId],
        (error, results) => {
            res.redirect('/notes');
        }

    );
})

// display from to edit note
app.get('/edit/:id', (req, res) => {
    if(res.locals.isLoggedIn) {
        connection.query(
            'SELECT * FROM notes WHERE id = ? AND userID = ?',
            [req.params.id, req.session.userId],
            (error, results) => {
                res.render('edit-note.ejs', {note: results[0]})
            }
        )
    } else {
        res.redirect('/login')
    }
})

// editing a single note
app.post('/edit/:id', (req, res) => {
    connection.query(
        'UPDATE notes SET title = ?, body = ? WHERE id = ? AND userID = ?',
        [req.body.title, req.body.body, req.params.id, req.session.userId],
        (error, results) => {
            res.redirect('/notes');
        }
    )
})

// deletin a note
app.post('/delete/:id', (req, res) => {
    connection.query(
        'DELETE FROM notes WHERE id = ?',
        [req.params.id],
        (error, results) => {
            res.redirect('/notes');
        }
    )
})

// displaying login form 
app.get('/login', (req, res) => {
    if(res.locals.isLoggedIn) {
        res.redirect('/notes')
    } else {
        res.render('login.ejs', {error: false})
    }
})

// submittiong login form for user authentication
app.post('/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    connection.query(
        'SELECT * FROM users WHERE email = ?', [email],
        (error, results) => {
            if(results.length > 0){
                bcrypt.compare(password, results[0].password, (error, isEqual) => {
                    if(isEqual){
                        // console.log('Authentication successful')
                        req.session.userId = results[0].id;
                        req.session.username = results[0].username;
                        res.redirect('/notes');
                    } else {
                        // console.log('Authentication failed')
                        let message = 'Email/Password mismatch.'
                        res.render('login.ejs', {
                            error: true, 
                            errorMessage: message, 
                            email: email, 
                            password: password
                        });
                    }
                })
            } else {
                // console.log('User does not exist');
                let message = 'Account does not exist. Please create one.'
                res.render('login.ejs', {
                    error: true, 
                    errorMessage: message,
                    email: email,
                    password: password
                });
            }
        }
    );
})

// logout functionality
app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        res.redirect('/');
    })
})

// displaying sign up form
app.get('/signup', (req, res) => {

    if(res.locals.isLoggedIn) {
        res.redirect('/notes')
    } else {
        res.render('signup.ejs', {error: false})
    }
    
})

// submittiong sign up form for user registration
app.post('/signup', (req, res) => {
    let email = req.body.email,
        username = req.body.username,
        password = req.body.password,
        confirmPassword = req.body.confirmPassword;

    if(password === confirmPassword){
        bcrypt.hash(password, 10, (error, hash) => {
            connection.query(
                'SELECT email FROM users WHERE email = ?', [email],
                (error, results) => {
                    if(results.length === 0) {
                        connection.query(
                            'INSERT INTO users (email, username, password) VALUES (?,?,?)',
                            [email, username, hash],
                            (error, results) => {
                                res.redirect('/login');
                            }
                        )
                    } else {
                        let message = 'Email already exists.'
                        res.render('signup.ejs', {
                            error: true,
                            errorMessage: message,
                            email: email,
                            username: username,
                            password:password,
                            confirmPassword: confirmPassword
                        })
                    }
                }
            )
        })
        
    } else {
        let message = 'Password & Confirm Password do not match.'
        res.render('signup.ejs', {
            error: true,
            errorMessage: message,
            email: email,
            username: username,
            password: password,
            confirmPassword: confirmPassword
        })
    }

})

// page not found (set after all defined routes)
app.get('*', (req, res) => {
    res.render('404.ejs')
})

app.listen(3000);
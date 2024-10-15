const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// PostgreSQL Pool setup
const pool = new Pool
({
  user: 'ryanwood',
  host: 'localhost',
  database: 'blogdb',
  password: 'your-database-password',
  port: 5432,
});

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Middleware to check if a user is authenticated
function isAuthenticated(req, res, next) 
{
  if (req.session.user) 
  {
    return next();
  }
  res.redirect('/signin');
}

// Route to render the homepage with all posts
app.get('/', async (req, res) => 
{
  try 
  {
    const result = await pool.query(`
      SELECT blogs.*, users.name AS creator_name
      FROM blogs
      JOIN users ON blogs.creator_user_id = users.user_id
      ORDER BY date_created DESC
    `);
    res.render('index', { posts: result.rows, user: req.session.user });
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error loading posts.');
  }
});

// Route to render the signup page
app.get('/signup', (req, res) => 
{
  res.render('signup');
});

// Route to handle signup
app.post('/signup', async (req, res) => 
{
  const { username, password, name } = req.body;
  try 
  {
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) 
    {
      return res.send('Username already taken. Try a different one.');
    }

    await pool.query(
      'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)',
      [username, password, name]
    );

    res.redirect('/signin');
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error signing up.');
  }
});

// Route to render the sign-in page
app.get('/signin', (req, res) => 
{ 
  res.render('signin');
});

// Route to handle sign-in
app.post('/signin', async (req, res) => 
{
  const { username, password } = req.body;
  try 
  {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (userResult.rows.length === 0) 
    {
      return res.send('Invalid username or password. Try again.');
    }

    req.session.user = userResult.rows[0];
    res.redirect('/');
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error signing in.');
  }
});

// Route to handle logout
app.get('/logout', (req, res) => 
{
  req.session.destroy();
  res.redirect('/');
});

// Route to render the new post form 
app.get('/posts', isAuthenticated, (req, res) => 
{
  res.render('posts');
});

// Route to handle post creation
app.post('/posts', isAuthenticated, async (req, res) => 
{
  const { title, content } = req.body;
  const creatorId = req.session.user.user_id;
  try 
  {
    await pool.query
    (
      'INSERT INTO blogs (creator_user_id, title, body) VALUES ($1, $2, $3)',
      [creatorId, title, content]
    );
    res.redirect('/');
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error creating post.');
  }
});

// Route to render the edit form 
app.get('/posts/edit/:id', isAuthenticated, async (req, res) => 
{
  const { id } = req.params;
  try 
  {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [id]);
    if (result.rows.length === 0 || result.rows[0].creator_user_id !== req.session.user.user_id) 
    {
      return res.status(403).send('You can only edit your own posts.');
    }
    res.render('edit', { post: result.rows[0] });
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error loading post for edit.');
  }
});

// Route to handle post updates
app.post('/posts/edit/:id', isAuthenticated, async (req, res) => 
{
  const { id } = req.params;
  const { title, content } = req.body;
  try 
  {
    await pool.query('UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3', [title, content, id]);
    res.redirect('/');
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error updating post.');
  }
});

// Route to handle post deletion 
app.post('/posts/delete/:id', isAuthenticated, async (req, res) => 
{
  const { id } = req.params;
  try 
  {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [id, req.session.user.user_id]);
    if (result.rows.length === 0) 
    {
      return res.status(403).send('You can only delete your own posts.');
    }
    await pool.query('DELETE FROM blogs WHERE blog_id = $1', [id]);
    res.redirect('/');
  } 
  catch (err) 
  {
    console.error(err);
    res.status(500).send('Error deleting post.');
  }
});

// Start the server
app.listen(3000, () => 
{
  console.log('Server running at http://localhost:3000');
});
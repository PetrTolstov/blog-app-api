const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

mongoose.connect(
    "mongodb+srv://bakuganin:5051Peniss@atlascluster.cxfstga.mongodb.net/test"
);

const articleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        required: true,
    },
    tagList: {
        type: [],
        required: true,
    },
    createdAt: {
        type: String,
        required: true,
    },
    updatedAt: {
        type: String,
        required: true,
    },

    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
    ],
});

const Article = mongoose.model("Article", articleSchema);

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },

    bio: {
        type: String,
        required: false,
    },
    image: {
        type: String,
        required: false,
    },
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};
const User = mongoose.model("User", userSchema);

const commentSchema = new mongoose.Schema({
    body: {
        type: String,
        required: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: String,
        required: true,
    },
    updatedAt: {
        type: String,
        required: true,
    },
    article: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
        required: true,
    },
});

const Comment = mongoose.model("Comment", commentSchema);

const app = express();

app.use(cookieParser());
app.use(bodyParser.json());
const auth = (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res
            .status(401)
            .json({ message: "Authorization header is required" });
    }
    try {
        const decodedToken = jwt.verify(token, "process.env.JWT_SECRET");
        req.user = decodedToken.user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: "Invalid token" });
    }
};

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;


        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: "User with this email already exists" });
        }

    
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);


        const newUser = new User({
            username,
            email,
            passwordHash,
        });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res
            .status(400)
            .json({ message: "Email and password are required" });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const passwordMatch = await user.comparePassword(password);
        if (!passwordMatch) {
            return res
                .status(401)
                .json({ message: "Invalid email or password" });
        }
        const token = jwt.sign({ user: user._id }, process.env.JWT_SECRET);
        res.cookie("jwt", token, { httpOnly: true });
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/user", auth, (req, res) => {
    const currentUser = req.user;
    res.json(currentUser);
});

app.put("/users/:username", async (req, res) => {
    const { username } = req.params;
    const { email } = req.body;

    try {
        const updatedUser = await User.findOneAndUpdate(
            { username },
            { email },
            { new: true }
        );
        res.send(updatedUser);
    } catch (err) {
        res.status(400).send({ error: "Failed to update user" });
    }
});

app.get("/articles", async (req, res) => {
    try {
        const articles = await Article.find()
        res.json(articles);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

app.post("/articles", (req, res) => {
    const { title, body, author, slug, tagList, createdAt, updatedAt } =
        req.body;
    const article = new Article({
        title,
        body,
        author,
        slug,
        tagList,
        createdAt,
        updatedAt,
    });

    article.save((err, savedArticle) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error creating article");
        } else {
            res.status(201).json(savedArticle);
        }
    });
});

app.get("/articles/:id", async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        res.json(article);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put('/articles/:id', async (req, res) => {
    try {
      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ message: 'Статья не найдена' });
      }
  
      article.title = req.body.title || article.title;
      article.body = req.body.body || article.body;
      article.author = req.body.author || article.author;
      article.slug = req.body.slug || article.slug;
      article.tagList = req.body.tagList || article.tagList;
      article.updatedAt = Date.now();
  
      const updatedArticle = await article.save();
  
      res.json({
        id: updatedArticle._id,
        title: updatedArticle.title,
        body: updatedArticle.body,
        author: updatedArticle.author,
        slug: updatedArticle.slug,
        tagList: updatedArticle.tagList,
        createdAt: updatedArticle.createdAt,
        updatedAt: updatedArticle.updatedAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  
  app.delete('/articles/:id', async (req, res) => {
    const id = req.params.id;
    try {
      await Article.findByIdAndRemove(id);
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

  app.post("/articles/:articleId/comments", async (req, res) => {
    const { articleId } = req.params;
    const { body, author } = req.body;
  
    try {
      const article = await Article.findById(articleId);

      const comment = new Comment({
        body,
        author,
        createdAt: new Date(),
        updatedAt: new Date(),
        article: article._id,
      });

      await comment.save();

      article.comments.push(comment._id);
      await article.save();

      res.json({ comment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });
  
  app.get("/articles/:articleId/comments", async (req, res) => {
    const { articleId } = req.params;
  
    try {
      const article = await Article.findById(articleId).populate("comments");

      const comments = article.comments.filter((comment) => comment !== null);

      res.json({ comments });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to retrieve comments" });
    }
  });

  app.put('/comments/:id', async (req, res) => {
    try {
      const { body } = req.body;
      const { id } = req.params;
  
      const comment = await Comment.findByIdAndUpdate(id, { body }, { new: true });
  
      res.json({ comment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get("/comments/:commentId", async (req, res) => {
    const commentId = req.params.commentId;
  
    try {
      const comment = await Comment.findOne({ _id: commentId }, null);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
  
      return res.status(200).json({ comment });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
    
  app.delete("/comments/:commentId", async (req, res) => {
  try {
    const deletedComment = await Comment.findByIdAndDelete(req.params.commentId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  
app.listen(3000, () => {
    console.log("Server started on port 3000");
});
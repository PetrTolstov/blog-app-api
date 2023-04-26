const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
// подключаемся к базе данных
mongoose.connect(
    "mongodb+srv://test:test@cluster0.8hvk9wi.mongodb.net/blog-app?retryWrites=true&w=majority"
);

const dbName = "blog-app";
// создаем модели данных для таблиц articles, users и comments
const Article = require("./models/article");
const User = require("./models/user");
const Comment = require("./models/comment");

// создаем приложение Express.js
const app = express();

app.use(cookieParser());
// middleware для парсинга JSON
app.use(bodyParser.json());
// middleware для проверки авторизации
const auth = (req, res, next) => {
    // проверяем наличие заголовка Authorization в запросе
    const token = req.cookies.jwt;
    if (!token) {
        return res
            .status(401)
            .json({ message: "Authorization header is required" });
    }
    try {
        // верифицируем токен и извлекаем данные пользователя
        const decodedToken = jwt.verify(token, 'process.env.JWT_SECRET');
        req.user = decodedToken.user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: "Invalid token" });
    }
};

// регистрация нового пользователя
app.post("/api/users", async (req, res) => {
    try {
        const { email, username, password } = req.body.user;
        const user = new User({ email, username, password });
        await user.save();
        // генерируем JWT токен и сохраняем его в http-only cookie
        const token = jwt.sign({ user: user }, 'process.env.JWT_SECRET', {
            expiresIn: "1h",
        });
        console.log(token)
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        });
        res.json({ user });
    } catch (err) {
        return res.status(422).json({ message: "User already exists" });
    }
});

// аутентификация пользователя
app.post("/api/users/login", async (req, res) => {
    const { email, password } = req.body.user;
    try {
        const user = await User.findOne({ email });
        if (!user || !user.comparePassword(password)) {
            return res
                .status(401)
                .json({ message: "Invalid email or password" });
        }
        // генерируем JWT токен и сохраняем его в http-only cookie
        const token = jwt.sign({ user: user }, 'process.env.JWT_SECRET', {
            expiresIn: "1h",
        });
        console.log(token)
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        });
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// получение текущего пользователя
app.get("/api/user", auth, (req, res) => {
    res.json({ user: req.user });
});

// обновление данных пользователя
app.put("/api/user", auth, (req, res) => {
    const { email, username, password } = req.body.user;
    const user = req.user;
    user.email = email || user.email;
    user.username = username || user.username;
    user.password = password || user.password;
    user.save((err) => {
        if (err) {
            return res.status(422).json({ message: "User already exists" });
        }
        res.json({ user });
    });
});

// получение списка статей
app.get("/api/articles", (req, res) => {
    Article.find({})
        .then((articles) => {
            res.json({ articles });
        })
        .catch((err) => {
            throw err;
        });
});

// создание новой статьи
app.post("/api/articles", auth, (req, res) => {
    const { title, content } = req.body.article;
    const article = new Article({ title, content, author: req.user });

    article
        .save()
        .then(() => {
            res.json({ article });
        })
        .catch((err) => {
            console.log(err)
            res.status(422).json({ message: "Error creating article" });
        });
});

// получение одной статьи
app.get("/api/articles/:id", (req, res) => {
    Article.findById(req.params.id)
        .then((article) => {
            res.json({ article });
        })
        .catch((err) => {
            throw err;
        });
});

// обновление статьи
app.put("/api/articles/:id", auth, (req, res) => {
    const { title, content } = req.body.article;
    Article.findById(req.params.id)
        .then((article) => {
            if (!article) {
                return res.status(404).json({ message: "Article not found" });
            }
            if (article.author !== req.user) {
                return res.status(401).json({
                    message: "You are not authorized to edit this article",
                });
            }
            article.title = title || article.title;
            article.content = content || article.content;
            return article.save();
        })
        .then((article) => {
            res.json({ article });
        })
        .catch((err) => {
            console.error(err);
            res.status(422).json({ message: "Error updating article" });
        });
});

// удаление статьи
app.delete("/api/articles/:id", auth, async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        if (article.author !== req.user) {
            return res.status(401).json({
                message: "You are not authorized to delete this article",
            });
        }
        await article.remove();
        res.json({ message: "Article deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting article" });
    }
});

// создание нового комментария
app.post("/api/articles/:id/comments", auth, async (req, res) => {
    try {
        const { content } = req.body.comment;
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        const comment = new Comment({ content, author: req.user.id, article });
        article.comments.push(comment);
        await article.save();
        res.json({ comment });
    } catch (err) {
        res.status(422).json({ message: "Error creating comment" });
    }
});

// получение списка комментариев к статье
app.get("/api/articles/:id/comments", async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        res.json({ comments: article.comments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// получение одного комментария
app.get("/api/articles/:id/comments/:commentId", async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        const comment = article.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        res.json({ comment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// обновление комментария
app.put("/api/articles/:id/comments/:commentId", auth, async (req, res) => {
    try {
        const { content } = req.body.comment;
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        const comment = article.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        if (comment.author.id !== req.user.id) {
            return res.status(401).json({
                message: "You are not authorized to edit this comment",
            });
        }
        comment.content = content || comment.content;
        await article.save();
        res.json({ comment });
    } catch (error) {
        res.status(422).json({ message: "Error updating comment" });
    }
});

// удаление комментария
app.delete("/api/comments/:id", auth, (req, res) => {
    Comment.findById(req.params.id)
        .then((comment) => {
            if (!comment) {
                return res.status(404).json({ message: "Comment not found" });
            }
            if (comment.author.id !== req.user.id) {
                return res.status(401).json({
                    message: "You are not authorized to delete this comment",
                });
            }
            return comment.remove();
        })
        .then(() => {
            res.json({ message: "Comment deleted" });
        })
        .catch((err) => {
            throw err;
        });
});

// запускаем сервер на порту 3000
app.listen(3000, () => {
    console.log("Server started on port 3000");
});

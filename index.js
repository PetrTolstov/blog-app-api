const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

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

// middleware для парсинга JSON
app.use(bodyParser.json());

// middleware для проверки авторизации
const auth = (req, res, next) => {
    // проверяем наличие заголовка Authorization в запросе
    const token = req.headers.authorization;
    if (!token) {
        return res
            .status(401)
            .json({ message: "Authorization header is required" });
    }
    // проверяем валидность токена и сохраняем текущего пользователя в объекте запроса
    // далее мы будем использовать req.user в других маршрутах для получения текущего пользователя
    // или для проверки авторизации
    next();
};

// регистрация нового пользователя
app.post("/api/users", async (req, res) => {
    try {
        const { email, username, password } = req.body.user;
        const user = new User({ email, username, password });
        await user.save();
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
        return res.status(401).json({ message: "Invalid email or password" });
      }
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
    const { title, body } = req.body.article;
    const article = new Article({ title, body, author: req.user });
    article.save((err) => {
        if (err) {
            return res.status(422).json({ message: "Error creating article" });
        }
        res.json({ article });
    });
});

// получение одной статьи
app.get("/api/articles/:id", (req, res) => {
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        res.json({ article });
    });
});

// обновление статьи
app.put("/api/articles/:id", auth, (req, res) => {
    const { title, body } = req.body.article;
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        if (article.author.id !== req.user.id) {
            return res.status(401).json({
                message: "You are not authorized to edit this article",
            });
        }
        article.title = title || article.title;
        article.body = body || article.body;
        article.save((err) => {
            if (err) {
                return res
                    .status(422)
                    .json({ message: "Error updating article" });
            }
            res.json({ article });
        });
    });
});

// удаление статьи
app.delete("/api/articles/:id", auth, (req, res) => {
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        if (article.author.id !== req.user.id) {
            return res.status(401).json({
                message: "You are not authorized to delete this article",
            });
        }
        article.remove((err) => {
            if (err) throw err;
            res.json({ message: "Article deleted" });
        });
    });
});


// создание нового комментария
app.post("/api/articles/:id/comments", auth, (req, res) => {
    const { body } = req.body.comment;
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        const comment = new Comment({ body, author: req.user });
        article.comments.push(comment);
        article.save((err) => {
            if (err) {
                return res
                    .status(422)
                    .json({ message: "Error creating comment" });
            }
            res.json({ comment });
        });
    });
});

// получение списка комментариев к статье
app.get("/api/articles/:id/comments", (req, res) => {
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        res.json({ comments: article.comments });
    });
});

// получение одного комментария
app.get("/api/articles/:id/comments/:commentId", (req, res) => {
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        const comment = article.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        res.json({ comment });
    });
});

// обновление комментария
app.put("/api/articles/:id/comments/:commentId", auth, (req, res) => {
    const { body } = req.body.comment;
    Article.findById(req.params.id, (err, article) => {
        if (err) throw err;
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
        comment.body = body || comment.body;
        article.save((err) => {
            if (err) {
                return res
                    .status(422)
                    .json({ message: "Error updating comment" });
            }
            res.json({ comment });
        });
    });
});

// удаление комментария
app.delete("/api/comments/:id", auth, (req, res) => {
    Comment.findById(req.params.id, (err, comment) => {
        if (err) throw err;
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        if (comment.author.id !== req.user.id) {
            return res.status(401).json({
                message: "You are not authorized to delete this comment",
            });
        }
        comment.remove((err) => {
            if (err) throw err;
            res.json({ message: "Comment deleted" });
        });
    });
});

// запускаем сервер на порту 3000
app.listen(3000, () => {
    console.log("Server started on port 3000");
});

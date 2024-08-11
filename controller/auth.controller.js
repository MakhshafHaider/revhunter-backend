
const User = require('../schema/authSchema');

const authContoller = async (req, res) => {
  const { name, email } = req.body;
  console.log("called into body", req.body);
  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(200).json({ message: existingUser });
      return;
    }

    const newUser = new User({
      name,
      email,
    });

    await newUser.save();

    res.status(201).json({ message: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = authContoller;

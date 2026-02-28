const fs = require('fs');

async function testFileUpload() {
    // 1. Log in to get the User ID
    console.log("1. Logging in as secure_snehal...");
    const loginResponse = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "secure_snehal", roll_number: "9999" })
    });
    const loginData = await loginResponse.json();

    if (!loginData.userId) {
        console.log("Login failed! Did you change the username or password?", loginData);
        return;
    }
    console.log("Login successful! User ID:", loginData.userId);

    // 2. Create a fake text file to upload
    console.log("\n2. Creating a temporary test file...");
    fs.writeFileSync('basta_test.txt', 'Hello! This is a test file for the Basta platform.');

    // 3. Prepare the file for uploading
    console.log("\n3. Sending the file to the server...");
    const formData = new FormData();
    const fileBuffer = fs.readFileSync('basta_test.txt');
    const fileBlob = new Blob([fileBuffer], { type: 'text/plain' });
    
    // Attach the file and the user ID to the request
    formData.append('file', fileBlob, 'basta_test.txt');
    formData.append('uploader_id', loginData.userId);

    // 4. Send the request to your /upload route
    const uploadResponse = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData
    });

    const uploadData = await uploadResponse.json();
    console.log("\nServer replied:", uploadData);
}

testFileUpload();
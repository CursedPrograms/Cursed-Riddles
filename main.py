from cryptography.fernet import Fernet

def generate_key():
    return Fernet.generate_key()

def save_key(key, key_file):
    with open(key_file, 'wb') as keyfile:
        keyfile.write(key)

def load_key(key_file):
    return open(key_file, 'rb').read()

def encrypt_file(filename, key, output_filename):
    cipher_suite = Fernet(key)
    with open(filename, 'rb') as f:
        file_data = f.read()

    encrypted_data = cipher_suite.encrypt(file_data)

    with open(output_filename, 'wb') as encrypted_file:
        encrypted_file.write(encrypted_data)

def decrypt_file(encrypted_filename, key, output_filename):
    cipher_suite = Fernet(key)
    with open(encrypted_filename, 'rb') as ef:
        encrypted_data = ef.read()

    decrypted_data = cipher_suite.decrypt(encrypted_data)

    with open(output_filename, 'wb') as decrypted_file:
        decrypted_file.write(decrypted_data)

# Example usage
password = "your_super_secret_password".encode()  # Convert password to bytes
key = Fernet.generate_key()

# Save the key to a file for future use
save_key(key, 'key.key')

# Encrypt your .bf file
encrypt_file('your_riddle.bf', key, 'encrypted_riddle')

# Decrypt the file when you need to access the original .bf file
decrypt_file('encrypted_riddle', key, 'decrypted_riddle.bf')
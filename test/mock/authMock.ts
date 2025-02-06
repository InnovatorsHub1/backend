const mockProfile = {
    id: '123',
    emails: [{ value: 'test@example.com' }],
    displayName: 'Test User',
    photos: [{ value: 'photo-url' }],
};

const mockDbUser = {
    googleId: '123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'photo-url',
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockUserResult = {
    googleId: '123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'photo-url',
};


export { mockDbUser, mockProfile, mockUserResult };
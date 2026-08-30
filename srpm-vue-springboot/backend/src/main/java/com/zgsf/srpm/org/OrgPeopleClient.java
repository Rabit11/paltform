package com.zgsf.srpm.org;

import com.zgsf.srpm.domain.PersonDirectory;

import java.util.List;

public interface OrgPeopleClient {
    List<PersonDirectory> fetchAll();
}
